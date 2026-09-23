import { toMarkdown } from './parser.js';
import { formatListNumber } from './model.js';

const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('本地导出组件加载失败'));document.head.append(s);});
export function markdown(doc){return new Blob([toMarkdown(doc)],{type:'text/markdown;charset=utf-8'});}
export async function saveAs(blob,name,directory){
  if(directory){const handle=await directory.getFileHandle(name,{create:true}),writer=await handle.createWritable();await writer.write(blob);await writer.close();return 'folder'}
  const url=URL.createObjectURL(blob),anchor=Object.assign(document.createElement('a'),{href:url,download:name});document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return 'download';
}
const canvasBlob=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片生成失败')), 'image/png'));
export async function png(node,name,settings){
  if(!window.html2canvas)await load('./vendor/html2canvas.min.js');
  if(!window.JSZip)await load('./vendor/jszip.min.js');
  const letter=settings.page.size==='Letter',landscape=settings.page.orientation==='landscape';
  const page=letter?{width:816,height:1056}:{width:794,height:1123};
  if(landscape)[page.width,page.height]=[page.height,page.width];
  const margin={narrow:38,normal:57,wide:76}[settings.page.margin]||57;
  const staging=document.createElement('div');staging.style.cssText=`position:fixed;left:-12000px;top:0;width:${page.width}px;z-index:-1;background:#fff;`;
  const clone=node.cloneNode(true);clone.style.cssText+=`width:${page.width}px;max-width:none;min-height:0;margin:0;padding:${margin}px;box-shadow:none;border-radius:0;box-sizing:border-box;background:#fff;`;
  clone.querySelectorAll('h1,h2,h3,li,pre,blockquote,table,tr').forEach(el=>el.style.breakInside='avoid');
  staging.append(clone);document.body.append(staging);
  try{
    await Promise.all([...clone.querySelectorAll('img')].map(async img=>{
      await img.decode?.().catch(()=>{});
      const source=new URL(img.src,location.href);
      if(!source.protocol.startsWith('data:')&&source.origin!==location.origin){try{const response=await fetch(source.href,{mode:'cors'});if(!response.ok)throw new Error()}catch{throw new Error(`图片“${img.alt||source.hostname}”不允许跨域读取，无法生成 PNG。请下载图片后重新导入。`)}}
    }));
    const height=clone.scrollHeight,usableHeight=page.height-2*margin,cloneTop=clone.getBoundingClientRect().top;
    const lineBreaks=element=>{
      if(element.matches('table'))return [...element.querySelectorAll('tr')].map(row=>row.getBoundingClientRect().bottom-cloneTop);
      if(element.matches('ul,ol'))return [...element.querySelectorAll(':scope > li')].map(item=>item.getBoundingClientRect().bottom-cloneTop);
      const range=document.createRange();range.selectNodeContents(element);
      return [...new Set([...range.getClientRects()].map(rect=>Math.round(rect.bottom-cloneTop)))].sort((a,b)=>a-b);
    };
    const pages=[];let start=margin,end=start+usableHeight;
    for(const block of [...clone.children]){
      const top=block.getBoundingClientRect().top-cloneTop,bottom=block.getBoundingClientRect().bottom-cloneTop;
      if(bottom<=end)continue;
      if(top>start){pages.push({start,end:top});start=top;end=start+usableHeight;if(bottom<=end)continue;}
      const boundaries=lineBreaks(block).filter(value=>value>start&&value<bottom);
      while(bottom>end){
        let cut=boundaries.filter(value=>value<=end).at(-1);
        if(!cut)cut=boundaries.find(value=>value>start);
        if(!cut)cut=Math.min(end,bottom);
        pages.push({start,end:cut});start=cut;end=start+usableHeight;
      }
    }
    const lastBottom=Math.max(margin,...[...clone.children].map(block=>block.getBoundingClientRect().bottom-cloneTop));
    if(lastBottom>start)pages.push({start,end:lastBottom});if(!pages.length)pages.push({start:margin,end:Math.min(height-margin,margin+usableHeight)});
    const zip=new window.JSZip();
    for(let index=0;index<pages.length;index++){
      const {start:top,end:bottom}=pages[index],content=await window.html2canvas(clone,{scale:2,backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,width:page.width,height:Math.max(1,bottom-top),y:top,windowWidth:page.width,windowHeight:height,scrollX:0,scrollY:0});
      const pageCanvas=document.createElement('canvas');pageCanvas.width=page.width*2;pageCanvas.height=page.height*2;
      const context=pageCanvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,pageCanvas.width,pageCanvas.height);context.drawImage(content,0,margin*2);
      zip.file(`${name}-${String(index+1).padStart(2,'0')}.png`,await canvasBlob(pageCanvas));
    }
    return await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:4}});
  }catch(error){
    if(/taint|cross-origin|insecure/i.test(String(error)))throw new Error('图片包含无法读取的跨域资源，请先下载图片后重新导入，或移除该图片再导出。');
    throw error;
  }finally{staging.remove()}
}
export function pdf(name,settings){
  let style=document.getElementById('export-page-style');if(!style){style=document.createElement('style');style.id='export-page-style';document.head.append(style)}
  const margin={narrow:'8mm',normal:'12mm',wide:'18mm'}[settings.page.margin]||'12mm';
  style.textContent=`@page{size:${settings.page.size} ${settings.page.orientation};margin:${margin}}@media print{.document,.page-stage.page .document{padding:0!important;width:auto!important;max-width:none!important;min-height:0!important}.page-stage,.page-stage.continuous{overflow:visible!important}.document h1,.document h2,.document h3{break-after:avoid}.document p,.document li{orphans:2;widows:2}}`;
  const oldTitle=document.title;document.title=name;window.print();setTimeout(()=>{document.title=oldTitle},1500);
}

const PALETTES={clean:{ink:'26354D',muted:'66748A',accent:'315BCB',pale:'F1F4FA',line:'D9E0EA',code:'20283A'},business:{ink:'26364A',muted:'64758A',accent:'245184',pale:'EFF4F9',line:'D6E0EA',code:'202A38'},academic:{ink:'302B2A',muted:'70625F',accent:'762F38',pale:'F7F1EF',line:'E5D8D5',code:'28252A'},study:{ink:'283A32',muted:'66776E',accent:'47765E',pale:'EFF5F0',line:'D8E3DB',code:'26352D'},report:{ink:'26364A',muted:'64758A',accent:'245184',pale:'EFF4F9',line:'D6E0EA',code:'202A38'},modern:{ink:'292929',muted:'6B6B6B',accent:'3F3F3F',pale:'F3F3F3',line:'DDDDDD',code:'252525'},official:{ink:'222222',muted:'555555',accent:'9A2C2C',pale:'F5EFEF',line:'DDCECE',code:'282525'},notion:{ink:'292929',muted:'6B6B6B',accent:'3F3F3F',pale:'F3F3F3',line:'DDDDDD',code:'252525'},github:{ink:'24292F',muted:'656D76',accent:'0969DA',pale:'F6F8FA',line:'D0D7DE',code:'24292F'}};
const DOCX_PALETTE={ink:'111111',muted:'333333',accent:'111111',pale:'F2F2F2',line:'BFBFBF',code:'EEEEEE'};
const greek={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',theta:'θ',lambda:'λ',mu:'μ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Omega:'Ω'};
const symbols={times:'×',cdot:'·',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',approx:'≈',equiv:'≡',pm:'±',infty:'∞',rightarrow:'→',to:'→',Rightarrow:'⇒',leftarrow:'←',sum:'∑',prod:'∏',partial:'∂',nabla:'∇'};
const fontOptions=settings=>({ascii:settings.fonts.latin||'Arial',hAnsi:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei',cs:settings.fonts.latin||'Arial',hint:'eastAsia'});
const pxToHalfPoints=px=>Math.round(px*1.5);
const lineTwips=(_px,leading=1.7)=>Math.round(240*leading);
const imageDimensions=new Map();
function mathSource(tex){
  let source=String(tex).replace(/\\(?:mathrm|text|mathbf|operatorname|mathit|mathsf)\{([^{}]*)\}/g,'$1').replace(/\\(?:left|right)\s*/g,'');
  source=source.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'$1⁄$2').replace(/\\sqrt\{([^{}]+)\}/g,'√$1');
  return source.replace(/\\([A-Za-z]+)/g,(_match,name)=>greek[name]||symbols[name]||name);
}
function makeRuns(text,D,settings,palette,base={},bodySize=pxToHalfPoints(Math.max(settings.sizes.body||14,14))){
  const font=fontOptions(settings),normal={font,language:{value:'en-US',eastAsia:'zh-CN'},size:bodySize,color:palette.ink,characterSpacing:Math.round((settings.paragraph.letterSpacing||0)*15),...base};
  const tokens=/!\[[^\]]*\]\([^)]+\)|\\\([\s\S]+?\\\)|\$(?!\$)[^$\n]+\$|`[^`\n]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|==[\s\S]+?==|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|\^[^^\n]+\^|(?<!~)~[^~\n]+~(?!~)|\[[^\]]+\]\([^)]+\)/g;
  const result=[];
  const add=(value,options={})=>{
    const lines=String(value).split('\n');
    lines.forEach((line,index)=>{
      const baseFont=options.font||normal.font||font,runFont=/[\u3000-\u9fff\uf900-\ufaff]/.test(line)?{...baseFont,ascii:baseFont.eastAsia||baseFont.ascii,hAnsi:baseFont.eastAsia||baseFont.hAnsi}:baseFont;
      result.push(new D.TextRun({text:line||' ',...(index?{break:1}:{}),...normal,font:runFont,...options}));
    });
  };
  let last=0,match;
  while((match=tokens.exec(String(text)))){
    add(String(text).slice(last,match.index));
    const token=match[0];
    if(token.startsWith('![')){
      const image=token.match(/^!\[([^\]]*)\]\(([^)]+)\)$/),uri=image?.[2]||'';
      if(uri.startsWith('data:image/')){
        const [metadata,data]=uri.split(',',2),bytes=metadata.includes(';base64')?Uint8Array.from(atob(data),character=>character.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(data));
        const [naturalWidth,naturalHeight]=imageDimensions.get(uri)||[420,280],scale=Math.min(1,500/naturalWidth,650/naturalHeight);
        result.push(new D.ImageRun({data:bytes,transformation:{width:Math.round(naturalWidth*scale),height:Math.round(naturalHeight*scale)},altText:{title:image[1],description:image[1],name:image[1]}}));
      }else add(image?.[1]?`[图片：${image[1]}]`:'[图片]');
    }
    else if(token.startsWith('\\(')){addMath(token.slice(2,-2))}
    else if(token.startsWith('$')){addMath(token.slice(1,-1))}
    else if(token.startsWith('`'))add(token.slice(1,-1),{font:{ascii:settings.fonts.code||'Consolas',hAnsi:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},size:pxToHalfPoints(settings.sizes.code||13),shading:{fill:palette.pale}});
    else if(token.startsWith('**')||token.startsWith('__'))add(token.slice(2,-2),{bold:true});
    else if(token.startsWith('~~'))add(token.slice(2,-2),{strike:true});
    else if(token.startsWith('=='))add(token.slice(2,-2),{highlight:'EEEEEE'});
    else if(token.startsWith('^'))add(token.slice(1,-1),{superScript:true});
    else if(token.startsWith('~'))add(token.slice(1,-1),{subScript:true});
    else if(token.startsWith('*')||token.startsWith('_'))add(token.slice(1,-1),{italics:true});
    else {const link=token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);add(link?`${link[1]} (${link[2]})`:token)}
    last=tokens.lastIndex;
  }
  add(String(text).slice(last));
  return result.length?result:[new D.TextRun({text:' ',...normal})];
  function addMath(tex){
    const source=mathSource(tex),scripts=/([_^])(?:\{([^{}]+)\}|([A-Za-z0-9]))/g;
    let cursor=0,part;
    while((part=scripts.exec(source))){add(source.slice(cursor,part.index).replace(/[{}]/g,''));const value=part[2]||part[3];add(value,{[part[1]==='_'?'subScript':'superScript']:true});cursor=scripts.lastIndex}
    add(source.slice(cursor).replace(/[{}]/g,''));
  }
}
function paragraph(D,text,settings,palette,options={}){
  const {run={},...paragraphOptions}=options;
  return new D.Paragraph({children:makeRuns(text,D,settings,palette,run),...paragraphOptions});
}
function tableCell(D,text,settings,palette,header=false){
  return new D.TableCell({children:[paragraph(D,text,settings,palette,{run:header?{bold:true,color:palette.ink}: {},spacing:{before:70,after:70,line:320}})],shading:{fill:header?palette.pale:'FFFFFF'},margins:{top:120,bottom:120,left:140,right:140},verticalAlign:'center'});
}
function pageDimensions(settings){
  const letter=settings.page.size==='Letter',portrait={width:letter?12240:11906,height:letter?15840:16838};
  const marginTwips={narrow:680,normal:850,wide:1360}[settings.page.margin]||850;
  return {page:settings.page.orientation==='landscape'?{width:portrait.height,height:portrait.width}:portrait,margin:marginTwips};
}
function blockParagraphs(block,D,settings,palette){
  const bodySize=Math.max(settings.sizes.body||14,14),spacing=Math.round((settings.paragraph.spacing||12)*11.25),line=lineTwips(bodySize,Math.max(1.5,settings.paragraph.lineHeight||1.65)),font=fontOptions(settings);
  const text=block.content||'';
  if(block.type==='title'){const style=settings.headings.h1;return [paragraph(D,text,settings,palette,{heading:D.HeadingLevel.HEADING_1,alignment:D.AlignmentType[style.align.toUpperCase()],keepNext:true,spacing:{before:0,after:Math.round(spacing*1.2),line:lineTwips(bodySize+10,1.25)},run:{bold:true,color:palette.ink,size:pxToHalfPoints((settings.sizes.h1||26)+5),font:{...font,eastAsia:style.font||settings.fonts.heading||settings.fonts.body||'Microsoft YaHei'}}})]}
  if(block.type==='heading'){
    const level=Math.min(Math.max(block.level||1,1),3),levelStyle=settings.headings[`h${level}`],size=settings.sizes[`h${level}`]||({1:26,2:20,3:16})[level];
    return [paragraph(D,text,settings,palette,{heading:D.HeadingLevel[`HEADING_${level}`],alignment:D.AlignmentType[levelStyle.align.toUpperCase()],keepNext:true,spacing:{before:Math.round(levelStyle.before*15),after:Math.round(levelStyle.after*15),line:lineTwips(size,1.28)},run:{bold:levelStyle.bold,color:palette.ink,size:pxToHalfPoints(size),font:{...font,eastAsia:levelStyle.font||settings.fonts.heading||settings.fonts.body||'Microsoft YaHei'}}})];
  }
  if(block.type==='intro')return [paragraph(D,text,settings,palette,{spacing:{after:Math.round(spacing*1.5),line:lineTwips(bodySize,1.8)},run:{color:palette.muted,size:pxToHalfPoints(bodySize)}})];
  if(block.type==='paragraph')return [paragraph(D,text,settings,palette,{alignment:D.AlignmentType.LEFT,indent:settings.paragraph.firstLineIndent?{firstLine:Math.round(settings.paragraph.firstLineIndent*bodySize*15)}:undefined,spacing:{before:Math.round((settings.paragraph.before||0)*11.25),after:spacing,line},keepLines:true})];
  if(block.type==='question'||block.type==='answerItem'){
    const number=block.number||'';
    const marker=new D.TextRun({text:`${number} `,font,size:pxToHalfPoints(bodySize),bold:true,color:block.type==='answerItem'?palette.accent:palette.ink});
    return [new D.Paragraph({children:[marker,...makeRuns(text,D,settings,palette)],indent:{left:420,hanging:420},keepNext:block.type==='question'&&block.kind==='choice',keepLines:true,spacing:{before:100,after:110,line}})];
  }
  if(block.type==='answerNote')return [paragraph(D,text,settings,palette,{spacing:{before:100,after:140,line},run:{color:palette.muted}})];
  const listIndent=Math.round(settings.list.indent*15),listSpacing=Math.round(settings.list.spacing*11.25);
  if(block.type==='bulletList')return block.items.map(item=>new D.Paragraph({children:makeRuns(item,D,settings,palette),bullet:{level:0},indent:{left:listIndent,hanging:Math.min(listIndent,240)},keepLines:true,spacing:{after:listSpacing,line}}));
  if(block.type==='orderedList')return block.items.map((item,index)=>new D.Paragraph({children:[new D.TextRun({text:`${formatListNumber(index,settings.list.numbering,block.numbers?.[index])} `,font,bold:true,color:palette.accent}),...makeRuns(item,D,settings,palette)],indent:{left:listIndent,hanging:Math.min(listIndent,300)},keepLines:true,spacing:{after:listSpacing,line}}));
  if(block.type==='choiceList')return block.items.map((item,index)=>new D.Paragraph({children:[new D.TextRun({text:`${String.fromCharCode(65+index)}. `,font,bold:true,color:palette.accent}),...makeRuns(item,D,settings,palette)],indent:{left:listIndent,hanging:Math.min(listIndent,300)},keepLines:true,spacing:{after:listSpacing,line}}));
  if(block.type==='blockquote')return block.content.split('\n').map(lineText=>paragraph(D,lineText,settings,palette,{indent:{left:360,right:180},border:{left:{color:palette.accent,space:8,style:'single',size:16}},shading:{fill:palette.pale},spacing:{before:45,after:110,line},keepLines:true}));
  if(block.type==='flowDiagram'||block.type==='operatorSequence')return [paragraph(D,block.steps.map((step,index)=>`${index?`   ${block.connectors?.[index-1]||'→'}   `:''}${step}`).join(''),settings,palette,{alignment:D.AlignmentType.CENTER,shading:{fill:palette.pale},spacing:{before:120,after:160,line:lineTwips(bodySize+2,1.5)},keepLines:true,run:{bold:true,color:palette.ink}})];
  if(block.type==='codeBlock'){
    const codeFont=settings.fonts.code||'Consolas',codeRuns=block.content.split('\n').map((lineText,index)=>new D.TextRun({text:lineText||' ',...(index?{break:1}:{}),font:{ascii:codeFont,hAnsi:codeFont,eastAsia:codeFont},size:pxToHalfPoints(Math.max(settings.sizes.code||11,11)),color:'111111'}));
    return [new D.Paragraph({style:'CodeBlock',children:codeRuns,shading:{fill:palette.code},indent:{left:190,right:190},spacing:{before:140,after:190,line:300},keepLines:true})];
  }
  if(block.type==='mathBlock')return [new D.Paragraph({children:makeRuns(text,D,settings,palette,{font:{ascii:'Cambria Math',hAnsi:'Cambria Math',eastAsia:settings.fonts.body||'Microsoft YaHei'}}),alignment:D.AlignmentType.CENTER,spacing:{before:120,after:150,line},shading:{fill:palette.pale}})];
  if(block.type==='divider')return [new D.Paragraph({text:' ',border:{bottom:{color:palette.line,space:1,style:'single',size:5}},spacing:{before:80,after:160}})];
  return [];
}
function buildDocx(doc,settings,D){
  const palette=DOCX_PALETTE,children=[];
  for(const block of doc.blocks){
    if(block.type==='table'){
      const headers=block.header||[],borders={top:{style:'single',size:4,color:palette.line},bottom:{style:'single',size:4,color:palette.line},left:{style:'single',size:4,color:palette.line},right:{style:'single',size:4,color:palette.line},insideHorizontal:{style:'single',size:3,color:palette.line},insideVertical:{style:'single',size:3,color:palette.line}};
      const rows=[new D.TableRow({tableHeader:true,cantSplit:true,children:headers.map(value=>tableCell(D,value,settings,palette,true))}),...(block.rows||[]).map(row=>new D.TableRow({cantSplit:true,children:headers.map((_,index)=>tableCell(D,row[index]||'',settings,palette,false))}))];
      children.push(new D.Table({rows,width:{size:100,type:D.WidthType.PERCENTAGE},layout:D.TableLayoutType.AUTOFIT,cellMargin:{top:120,bottom:120,left:140,right:140},borders}));
      children.push(new D.Paragraph({text:' ',spacing:{after:120}}));continue;
    }
    children.push(...blockParagraphs(block,D,settings,palette));
  }
  const font=fontOptions(settings),bodySize=pxToHalfPoints(Math.max(settings.sizes.body||14,14)),{page,margin}=pageDimensions(settings),codeFont=settings.fonts.code||'Consolas';
  return new D.Document({
    styles:{
      default:{document:{run:{font,language:{value:'en-US',eastAsia:'zh-CN'},size:bodySize,color:palette.ink},paragraph:{spacing:{after:180,line:420}}}},
      paragraphStyles:[{id:'CodeBlock',name:'Code Block',basedOn:'Normal',next:'Normal',paragraph:{shading:{fill:palette.code},indent:{left:190,right:190},spacing:{before:140,after:190,line:300},keepLines:true},run:{font:{ascii:codeFont,hAnsi:codeFont,eastAsia:codeFont},size:pxToHalfPoints(Math.max(settings.sizes.code||11,11)),color:'111111'}}]
    },
    sections:[{properties:{page:{size:page,margin:{top:margin,right:margin,bottom:margin,left:margin}}},children}],
    numbering:{config:[{reference:'unordered',levels:[{level:0,format:'bullet',text:'•',alignment:'left',style:{paragraph:{indent:{left:440,hanging:220}},run:{font:'Arial'}}}]}]}
  });
}
async function inlineImagesAsData(doc){
  const copy=JSON.parse(JSON.stringify(doc)),pattern=/!\[([^\]]*)\]\(([^)]+)\)/g;
  async function normalizeImage(source,alt){
    const image=new Image();image.src=source;try{await image.decode()}catch{throw new Error(`图片“${alt||'未命名图片'}”无法解码。`)}
    const width=image.naturalWidth,height=image.naturalHeight;if(!width||!height)throw new Error(`图片“${alt||'未命名图片'}”尺寸无效。`);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(image,0,0);
    const data=canvas.toDataURL('image/png');imageDimensions.set(data,[width,height]);return data;
  }
  async function convert(value){
    let text=String(value);
    for(const match of [...text.matchAll(pattern)]){
      const [,alt,url]=match;if(url.startsWith('data:image/')){const data=await normalizeImage(url,alt);text=text.replace(match[0],`![${alt}](${data})`);continue;}
      let response;try{response=await fetch(url)}catch{throw new Error(`图片“${alt||url}”无法读取；请确认图片链接可访问且允许跨域读取。`)}
      if(!response.ok)throw new Error(`图片“${alt||url}”读取失败（${response.status}）。`);
      const blob=await response.blob();if(!blob.type.startsWith('image/'))throw new Error(`“${alt||url}”不是可识别的图片文件。`);
      const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob)}),data=await normalizeImage(source,alt);
      text=text.replace(match[0],`![${alt}](${data})`);
    }
    return text;
  }
  for(const block of copy.blocks){
    if(typeof block.content==='string')block.content=await convert(block.content);
    for(const key of ['items','header'])if(Array.isArray(block[key]))block[key]=await Promise.all(block[key].map(value=>typeof value==='string'?convert(value):value));
    if(Array.isArray(block.rows))block.rows=await Promise.all(block.rows.map(row=>Promise.all(row.map(convert))));
  }
  return copy;
}
export async function docx(doc,settings,name){
  if(!window.docx)await load('./vendor/docx.umd.js');
  if(!window.docx)throw new Error('Word 导出组件加载失败');
  const localSettings={...settings,fonts:{...settings.fonts}};
  localSettings.sizes={...settings.sizes,body:Math.min(settings.sizes.body||15,14),h1:Math.min(settings.sizes.h1||29,26),h2:Math.min(settings.sizes.h2||22,20),h3:Math.min(settings.sizes.h3||18,16),code:Math.min(settings.sizes.code||12,11)};
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&localSettings.fonts.body==='Microsoft YaHei')localSettings.fonts.body='PingFang SC';
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&localSettings.fonts.heading==='Microsoft YaHei')localSettings.fonts.heading=localSettings.fonts.body;
  const file=buildDocx(await inlineImagesAsData(doc),localSettings,window.docx);
  return await window.docx.Packer.toBlob(file);
}
