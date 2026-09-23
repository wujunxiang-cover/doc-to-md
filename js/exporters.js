import { toMarkdown } from './parser.js';

const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=Object.assign(document.createElement('a'),{href:u,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(u),300);};
const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('本地导出组件加载失败'));document.head.append(s);});
export function markdown(doc,name){download(new Blob([toMarkdown(doc)],{type:'text/markdown;charset=utf-8'}),`${name}.md`);}
export async function png(node,name){if(!window.html2canvas)await load('./vendor/html2canvas.min.js');const canvas=await window.html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true});canvas.toBlob(b=>download(b,`${name}.png`),'image/png');}
export function pdf(){window.print();}

const PALETTES={clean:{ink:'26354D',muted:'66748A',accent:'315BCB',pale:'F1F4FA',line:'D9E0EA',code:'20283A'},business:{ink:'26364A',muted:'64758A',accent:'245184',pale:'EFF4F9',line:'D6E0EA',code:'202A38'},academic:{ink:'302B2A',muted:'70625F',accent:'762F38',pale:'F7F1EF',line:'E5D8D5',code:'28252A'},notion:{ink:'292929',muted:'6B6B6B',accent:'3F3F3F',pale:'F3F3F3',line:'DDDDDD',code:'252525'},github:{ink:'24292F',muted:'656D76',accent:'0969DA',pale:'F6F8FA',line:'D0D7DE',code:'24292F'}};
const greek={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',theta:'θ',lambda:'λ',mu:'μ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Omega:'Ω'};
const symbols={times:'×',cdot:'·',leq:'≤',le:'≤',geq:'≥',ge:'≥',neq:'≠',approx:'≈',equiv:'≡',pm:'±',infty:'∞',rightarrow:'→',to:'→',Rightarrow:'⇒',leftarrow:'←',sum:'∑',prod:'∏',partial:'∂',nabla:'∇'};
const fontOptions=settings=>({ascii:settings.fonts.latin||'Arial',hAnsi:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei',cs:settings.fonts.latin||'Arial'});
const pxToHalfPoints=px=>Math.round(px*1.5);
const lineTwips=(_px,leading=1.7)=>Math.round(240*leading);
function mathSource(tex){
  let source=String(tex).replace(/\\(?:mathrm|text|mathbf|operatorname|mathit|mathsf)\{([^{}]*)\}/g,'$1').replace(/\\(?:left|right)\s*/g,'');
  source=source.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'$1⁄$2').replace(/\\sqrt\{([^{}]+)\}/g,'√$1');
  return source.replace(/\\([A-Za-z]+)/g,(_match,name)=>greek[name]||symbols[name]||name);
}
function makeRuns(text,D,settings,palette,base={},bodySize=pxToHalfPoints(Math.max(settings.sizes.body||16,17))){
  const font=fontOptions(settings),normal={font,language:{value:'en-US',eastAsia:'zh-CN'},size:bodySize,color:palette.ink,...base};
  const tokens=/\\\([\s\S]+?\\\)|\$(?!\$)[^$\n]+\$|`[^`\n]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|==[\s\S]+?==|(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)|\^[^^\n]+\^|(?<!~)~[^~\n]+~(?!~)|\[[^\]]+\]\([^)]+\)/g;
  const result=[];
  const add=(value,options={})=>{
    const lines=String(value).split('\n');
    lines.forEach((line,index)=>result.push(new D.TextRun({text:line||' ',...(index?{break:1}:{}),...normal,...options})));
  };
  let last=0,match;
  while((match=tokens.exec(String(text)))){
    add(String(text).slice(last,match.index));
    const token=match[0];
    if(token.startsWith('\\(')){addMath(token.slice(2,-2))}
    else if(token.startsWith('$')){addMath(token.slice(1,-1))}
    else if(token.startsWith('`'))add(token.slice(1,-1),{font:{ascii:settings.fonts.code||'Consolas',hAnsi:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},size:pxToHalfPoints(settings.sizes.code||13),shading:{fill:palette.pale}});
    else if(token.startsWith('**')||token.startsWith('__'))add(token.slice(2,-2),{bold:true});
    else if(token.startsWith('~~'))add(token.slice(2,-2),{strike:true});
    else if(token.startsWith('=='))add(token.slice(2,-2),{highlight:'FFF1B8'});
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
  const bodySize=Math.max(settings.sizes.body||16,17),spacing=Math.round((settings.paragraph.spacing||16)*11.25),line=lineTwips(bodySize,Math.max(1.55,settings.paragraph.lineHeight||1.7)),font=fontOptions(settings);
  const text=block.content||'';
  if(block.type==='title')return [paragraph(D,text,settings,palette,{heading:D.HeadingLevel.HEADING_1,keepNext:true,spacing:{before:0,after:Math.round(spacing*1.2),line:lineTwips(bodySize+12,1.25)},run:{bold:true,color:palette.ink,size:pxToHalfPoints((settings.sizes.h1||32)+8),font:{...font,eastAsia:settings.fonts.heading||settings.fonts.body||'Microsoft YaHei'}}})];
  if(block.type==='heading'){
    const level=Math.min(Math.max(block.level||1,1),3),size=settings.sizes[`h${level}`]||({1:32,2:24,3:19})[level];
    return [paragraph(D,text,settings,palette,{heading:D.HeadingLevel[`HEADING_${level}`],keepNext:true,spacing:{before:level===1?330:level===2?260:190,after:145,line:lineTwips(size,1.28)},run:{bold:true,color:palette.ink,size:pxToHalfPoints(size),font:{...font,eastAsia:settings.fonts.heading||settings.fonts.body||'Microsoft YaHei'}}})];
  }
  if(block.type==='intro')return [paragraph(D,text,settings,palette,{spacing:{after:Math.round(spacing*1.5),line:lineTwips(bodySize,1.8)},run:{color:palette.muted,size:pxToHalfPoints(bodySize)}})];
  if(block.type==='paragraph')return [paragraph(D,text,settings,palette,{alignment:D.AlignmentType.LEFT,spacing:{after:spacing,line},keepLines:true})];
  if(block.type==='question'||block.type==='answerItem'){
    const number=block.number||'';
    const marker=new D.TextRun({text:`${number} `,font,size:pxToHalfPoints(bodySize),bold:true,color:block.type==='answerItem'?palette.accent:palette.ink});
    return [new D.Paragraph({children:[marker,...makeRuns(text,D,settings,palette)],indent:{left:420,hanging:420},keepNext:block.type==='question'&&block.kind==='choice',keepLines:true,spacing:{before:100,after:110,line}})];
  }
  if(block.type==='answerNote')return [paragraph(D,text,settings,palette,{spacing:{before:100,after:140,line},run:{color:palette.muted}})];
  if(block.type==='bulletList')return block.items.map(item=>new D.Paragraph({children:makeRuns(item,D,settings,palette),bullet:{level:0},indent:{left:440,hanging:220},keepLines:true,spacing:{after:85,line}}));
  if(block.type==='orderedList')return block.items.map((item,index)=>new D.Paragraph({children:[new D.TextRun({text:`${block.numbers?.[index]||`${index+1}.`} `,font,bold:true,color:palette.accent}),...makeRuns(item,D,settings,palette)],indent:{left:440,hanging:440},keepLines:true,spacing:{after:85,line}}));
  if(block.type==='choiceList')return block.items.map((item,index)=>new D.Paragraph({children:[new D.TextRun({text:`${String.fromCharCode(65+index)}. `,font,bold:true,color:palette.accent}),...makeRuns(item,D,settings,palette)],indent:{left:480,hanging:300},keepLines:true,spacing:{after:75,line}}));
  if(block.type==='blockquote')return block.content.split('\n').map(lineText=>paragraph(D,lineText,settings,palette,{indent:{left:360,right:180},border:{left:{color:palette.accent,space:8,style:'single',size:16}},shading:{fill:palette.pale},spacing:{before:45,after:110,line},keepLines:true}));
  if(block.type==='codeBlock'){
    const codeFont=settings.fonts.code||'Consolas',codeRuns=block.content.split('\n').map((lineText,index)=>new D.TextRun({text:lineText||' ',...(index?{break:1}:{}),font:{ascii:codeFont,hAnsi:codeFont,eastAsia:codeFont},size:pxToHalfPoints(Math.max(settings.sizes.code||13,13)),color:'F0F3F8'}));
    return [new D.Paragraph({style:'CodeBlock',children:codeRuns,shading:{fill:palette.code},indent:{left:190,right:190},spacing:{before:140,after:190,line:300},keepLines:true})];
  }
  if(block.type==='mathBlock')return [new D.Paragraph({children:makeRuns(text,D,settings,palette,{font:{ascii:'Cambria Math',hAnsi:'Cambria Math',eastAsia:settings.fonts.body||'Microsoft YaHei'}}),alignment:D.AlignmentType.CENTER,spacing:{before:120,after:150,line},shading:{fill:palette.pale}})];
  if(block.type==='divider')return [new D.Paragraph({text:' ',border:{bottom:{color:palette.line,space:1,style:'single',size:5}},spacing:{before:80,after:160}})];
  return [];
}
function buildDocx(doc,settings,D){
  const palette=PALETTES[settings.theme]||PALETTES.clean,children=[];
  for(const block of doc.blocks){
    if(block.type==='table'){
      const headers=block.header||[],borders={top:{style:'single',size:4,color:palette.line},bottom:{style:'single',size:4,color:palette.line},left:{style:'single',size:4,color:palette.line},right:{style:'single',size:4,color:palette.line},insideHorizontal:{style:'single',size:3,color:palette.line},insideVertical:{style:'single',size:3,color:palette.line}};
      const rows=[new D.TableRow({tableHeader:true,cantSplit:true,children:headers.map(value=>tableCell(D,value,settings,palette,true))}),...(block.rows||[]).map(row=>new D.TableRow({cantSplit:true,children:headers.map((_,index)=>tableCell(D,row[index]||'',settings,palette,false))}))];
      children.push(new D.Table({rows,width:{size:100,type:D.WidthType.PERCENTAGE},layout:D.TableLayoutType.AUTOFIT,cellMargin:{top:120,bottom:120,left:140,right:140},borders}));
      children.push(new D.Paragraph({text:' ',spacing:{after:120}}));continue;
    }
    children.push(...blockParagraphs(block,D,settings,palette));
  }
  const font=fontOptions(settings),bodySize=pxToHalfPoints(Math.max(settings.sizes.body||16,17)),{page,margin}=pageDimensions(settings),codeFont=settings.fonts.code||'Consolas';
  return new D.Document({
    styles:{
      default:{document:{run:{font,language:{value:'en-US',eastAsia:'zh-CN'},size:bodySize,color:palette.ink},paragraph:{spacing:{after:180,line:420}}}},
      paragraphStyles:[{id:'CodeBlock',name:'Code Block',basedOn:'Normal',next:'Normal',paragraph:{shading:{fill:palette.code},indent:{left:190,right:190},spacing:{before:140,after:190,line:300},keepLines:true},run:{font:{ascii:codeFont,hAnsi:codeFont,eastAsia:codeFont},size:pxToHalfPoints(Math.max(settings.sizes.code||13,13)),color:'F0F3F8'}}]
    },
    sections:[{properties:{page:{size:page,margin:{top:margin,right:margin,bottom:margin,left:margin}}},children}],
    numbering:{config:[{reference:'unordered',levels:[{level:0,format:'bullet',text:'•',alignment:'left',style:{paragraph:{indent:{left:440,hanging:220}},run:{font:'Arial'}}}]}]}
  });
}
export async function docx(doc,settings,name){
  if(!window.docx)await load('./vendor/docx.umd.js');
  if(!window.docx)throw new Error('Word 导出组件加载失败');
  const localSettings={...settings,fonts:{...settings.fonts}};
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&localSettings.fonts.body==='Microsoft YaHei')localSettings.fonts.body='PingFang SC';
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&localSettings.fonts.heading==='Microsoft YaHei')localSettings.fonts.heading=localSettings.fonts.body;
  const file=buildDocx(doc,localSettings,window.docx);
  download(await window.docx.Packer.toBlob(file),`${name}.docx`);
}
