import { toMarkdown } from './parser.js';

const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=Object.assign(document.createElement('a'),{href:u,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(u),300);};
const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('资源加载失败'));document.head.append(s);});
export function markdown(doc,name){download(new Blob([toMarkdown(doc)],{type:'text/markdown;charset=utf-8'}),`${name}.md`);}
export async function png(node,name){await load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');const canvas=await window.html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true});canvas.toBlob(b=>download(b,`${name}.png`),'image/png');}
export function pdf(){window.print();}

const COLORS={ink:'243247',muted:'5F6B7B',accent:'5967C8',pale:'F2F4FC',line:'DCE2EE',code:'F4F6F8',white:'FFFFFF'};
function runs(text,D,settings,base={}){
  const result=[], pattern=/\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_|==(.+?)==|\^([^\^\n]+)\^|(?<!~)~([^~\n]+)~(?!~)/g;
  let last=0,match;
  const add=(value,options={})=>{if(value)result.push(new D.TextRun({text:value,font:{ascii:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei',hAnsi:settings.fonts.latin||'Arial'},size:Math.round(settings.sizes.body*1.5),color:COLORS.ink,...base,...options}));};
  while((match=pattern.exec(text))){add(text.slice(last,match.index));const value=match.slice(1).find(part=>part!==undefined)||'';const opts=match[1]||match[2]?{bold:true}:match[3]?{strike:true}:match[4]?{font:{ascii:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},shading:{fill:'E8ECF3'},size:Math.round(settings.sizes.code*1.5)}:match[5]||match[6]?{italics:true}:match[7]?{highlight:'FFF1B8'}:match[8]?{superScript:true}:{subScript:true};add(value,opts);last=pattern.lastIndex;}
  add(text.slice(last));return result.length?result:[new D.TextRun('')];
}
function para(D,text,settings,options={}){return new D.Paragraph({children:runs(text,D,settings,options.run||{}),...options});}
function cell(D,text,settings,header=false){return new D.TableCell({children:[new D.Paragraph({children:runs(text,D,settings,{bold:header,color:header?COLORS.white:COLORS.ink}),spacing:{before:50,after:50,line:300}})],shading:{fill:header?COLORS.accent:COLORS.white},margins:{top:100,bottom:100,left:120,right:120},verticalAlign:'center'});}

export async function docx(doc,settings,name){
  await load('https://unpkg.com/docx@8.5.0/build/index.umd.js');
  const D=window.docx;if(!D)throw new Error('Word 导出组件加载失败');
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&settings.fonts.body==='Microsoft YaHei') settings={...settings,fonts:{...settings.fonts,body:'PingFang SC'}};
  const children=[];
  for(const block of doc.blocks){
    const text=block.content||'';
    if(block.type==='title'){
      children.push(new D.Paragraph({style:'Title',keepNext:true,spacing:{before:0,after:100,line:420},children:runs(text,D,settings,{bold:true,color:'000000',size:42})}));
    }else if(block.type==='intro'){
      children.push(new D.Paragraph({children:runs(text,D,settings,{color:COLORS.muted,size:22}),spacing:{after:300,line:340}}));
    }else if(block.type==='heading'){
      const level=Math.min(block.level||1,3), sizes={1:34,2:28,3:23};
      children.push(new D.Paragraph({heading:`HEADING_${level}`,keepNext:true,spacing:{before:level===1?400:260,after:190,line:360},border:level===1?{top:{color:COLORS.line,space:10,style:'single',size:5}}:undefined,children:runs(text,D,settings,{bold:true,color:'000000',size:sizes[level]})}));
    }else if(block.type==='question'){
      children.push(new D.Paragraph({children:[new D.TextRun({text:`${block.number} `,bold:true,color:COLORS.ink,font:{ascii:'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5)}),...runs(text,D,settings)],indent:{left:350,hanging:350},keepNext:block.kind==='choice',spacing:{before:150,after:90,line:360}}));
    }else if(block.type==='answerItem'){
      children.push(new D.Paragraph({children:[new D.TextRun({text:`${block.number} `,bold:true,color:COLORS.accent,font:{ascii:'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5)}),...runs(text,D,settings)],indent:{left:350,hanging:350},spacing:{after:100,line:340}}));
    }else if(block.type==='answerNote'){
      children.push(para(D,text,settings,{spacing:{before:100,after:140,line:340}}));
    }else if(block.type==='paragraph'){
      children.push(para(D,text,settings,{spacing:{after:150,line:360},alignment:D.AlignmentType.JUSTIFIED}));
    }else if(block.type==='bulletList'||block.type==='orderedList'){
      block.items.forEach((item,index)=>children.push(new D.Paragraph({children:runs(item,D,settings),bullet:block.type==='bulletList'?{level:0}:undefined,numbering:block.type==='orderedList'?{reference:'main',level:0}:undefined,indent:{left:480,hanging:240},spacing:{after:90,line:330},keepLines:true})))
    }else if(block.type==='choiceList'){
      block.items.forEach((item,index)=>children.push(new D.Paragraph({children:[new D.TextRun({text:`${String.fromCharCode(65+index)}.`,bold:true,color:COLORS.accent,font:{ascii:'Arial',eastAsia:'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5)}),new D.TextRun({text:`  ${item}`,font:{ascii:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5),color:COLORS.ink})],indent:{left:650,hanging:300},spacing:{after:index===block.items.length-1?180:70,line:340},border:index===block.items.length-1?{bottom:{color:COLORS.line,space:8,style:'single',size:4}}:undefined,keepLines:true})))
    }else if(block.type==='blockquote'){
      block.content.split('\n').forEach(line=>children.push(para(D,line,settings,{indent:{left:400},border:{left:{color:COLORS.accent,space:8,style:'single',size:18}},shading:{fill:COLORS.pale},spacing:{before:40,after:120,line:340}})));
    }else if(block.type==='codeBlock'){
      block.content.split('\n').forEach(line=>children.push(new D.Paragraph({children:[new D.TextRun({text:line||' ',font:{ascii:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},size:Math.round(settings.sizes.code*1.5),color:'344054'})],style:'CodeBlock',spacing:{after:0,line:300}})));
    }else if(block.type==='mathBlock'){
      children.push(new D.Paragraph({children:runs(block.content,D,settings),alignment:D.AlignmentType.CENTER,shading:{fill:COLORS.pale},spacing:{before:120,after:160,line:360}}));
    }else if(block.type==='divider'){
      children.push(new D.Paragraph({text:' ',border:{bottom:{color:COLORS.line,space:1,style:'single',size:6}},spacing:{before:100,after:150}}));
    }else if(block.type==='table'){
      const headers=block.header||[],rows=[new D.TableRow({tableHeader:true,cantSplit:true,children:headers.map(value=>cell(D,value,settings,true))}),...(block.rows||[]).map(row=>new D.TableRow({cantSplit:true,children:headers.map((_,index)=>cell(D,row[index]||'',settings,false))}))];
      children.push(new D.Table({rows,width:{size:100,type:D.WidthType.PERCENTAGE},layout:D.TableLayoutType.AUTOFIT,cellMargin:{top:100,bottom:100,left:120,right:120},borders:{top:{style:'single',size:4,color:COLORS.line},bottom:{style:'single',size:4,color:COLORS.line},left:{style:'single',size:4,color:COLORS.line},right:{style:'single',size:4,color:COLORS.line},insideHorizontal:{style:'single',size:3,color:COLORS.line},insideVertical:{style:'single',size:3,color:COLORS.line}}}));
      children.push(new D.Paragraph({text:'',spacing:{after:100}}));
    }
  }
  const file=new D.Document({styles:{default:{document:{run:{font:{ascii:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei',hAnsi:settings.fonts.latin||'Arial'},size:24,color:COLORS.ink},paragraph:{spacing:{after:150,line:360}}}},paragraphStyles:[{id:'CodeBlock',name:'Code Block',basedOn:'Normal',paragraph:{shading:{fill:COLORS.code},indent:{left:220},spacing:{before:0,after:0,line:300}},run:{font:{ascii:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},size:19,color:'344054'}}]},sections:[{properties:{page:{size:settings.page.orientation==='landscape'?{width:16838,height:11906}:{width:11906,height:16838},margin:{top:1440,right:1440,bottom:1440,left:1440}}},children}],numbering:{config:[{reference:'main',levels:[{level:0,format:'decimal',text:'%1.',alignment:'left',style:{paragraph:{indent:{left:480,hanging:240}}}}]}]}});
  download(await D.Packer.toBlob(file),`${name}.docx`);
}
