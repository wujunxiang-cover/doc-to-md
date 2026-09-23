import { toMarkdown } from './parser.js';

const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=Object.assign(document.createElement('a'),{href:u,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(u),300);};
const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('本地导出组件加载失败'));document.head.append(s);});
export function markdown(doc,name){download(new Blob([toMarkdown(doc)],{type:'text/markdown;charset=utf-8'}),`${name}.md`);}
export async function png(node,name){if(!window.html2canvas)await load('./vendor/html2canvas.min.js');const canvas=await window.html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true});canvas.toBlob(b=>download(b,`${name}.png`),'image/png');}
export function pdf(){window.print();}

function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('预览页面图生成失败')),'image/png'));}
function pageBreaks(preview,canvas,scale,pageHeight,headings){
  const rootTop=preview.getBoundingClientRect().top,ends=[...preview.children].map(node=>(node.getBoundingClientRect().bottom-rootTop)*scale).filter(y=>Number.isFinite(y)&&y>0).sort((a,b)=>a-b);
  const breaks=[];let top=0;
  while(top<canvas.height){
    const target=Math.min(canvas.height,top+pageHeight);
    if(target===canvas.height){breaks.push(target);break;}
    const min=top+pageHeight*.5;
    const candidates=ends.filter(y=>y>=min&&y<=target);
    let end=candidates.length?candidates.at(-1):target;
    const headingCount=headings.filter(item=>item.top>=top-1&&item.top<end).length;
    const maxContentEnd=Math.min(target,top+pageHeight-Math.ceil(scale*(12+headingCount*44)));
    if(end>maxContentEnd){const safe=ends.filter(y=>y>=min&&y<=maxContentEnd);end=safe.length?safe.at(-1):maxContentEnd}
    end=Math.max(top+1,Math.min(end,canvas.height));
    breaks.push(end);top=end;
  }
  return breaks;
}
function twips(mm){return Math.round(mm/25.4*1440)}

export async function docx(_doc,settings,name,preview){
  if(!preview||!preview.isConnected)throw new Error('请先打开文档预览再导出 Word');
  if(!window.docx)await load('./vendor/docx.umd.js');
  if(!window.html2canvas)await load('./vendor/html2canvas.min.js');
  if(document.fonts?.ready)await document.fonts.ready;
  const D=window.docx,rect=preview.getBoundingClientRect(),width=preview.scrollWidth||Math.round(rect.width),height=preview.scrollHeight;
  if(!width||!height)throw new Error('预览内容为空，无法导出 Word');
  const scale=Math.max(.6,Math.min(2,24000/height,Math.sqrt(36000000/(width*height))));
  const canvas=await window.html2canvas(preview,{scale,backgroundColor:'#ffffff',width,height,useCORS:true,logging:false,windowWidth:document.documentElement.clientWidth,windowHeight:document.documentElement.clientHeight});
  const isLetter=settings.page.size==='Letter',portraitWidth=isLetter?215.9:210,portraitHeight=isLetter?279.4:297;
  const pageWidthMm=settings.page.orientation==='landscape'?portraitHeight:portraitWidth;
  const pageHeightMm=settings.page.orientation==='landscape'?portraitWidth:portraitHeight;
  const headings=[...preview.querySelectorAll('h1,h2,h3')].map(node=>({top:(node.getBoundingClientRect().top-preview.getBoundingClientRect().top)*scale,level:Number(node.tagName[1]),text:node.textContent.trim()}));
  const pageHeight=Math.max(100,Math.round(canvas.width*pageHeightMm/pageWidthMm)-Math.ceil(scale*8)),breaks=pageBreaks(preview,canvas,scale,pageHeight,headings),pageWidthPx=pageWidthMm/25.4*96;
  const pages=[];let top=0;
  for(const end of breaks){
    const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.max(1,Math.ceil(end-top));
    slice.getContext('2d').drawImage(canvas,0,top,canvas.width,slice.height,0,0,canvas.width,slice.height);
    const blob=await canvasBlob(slice),data=new Uint8Array(await blob.arrayBuffer());
    const imageHeightPx=(slice.height/scale)*(pageWidthPx/width);
    pages.push({data,height:imageHeightPx,top,end,headings:headings.filter(item=>item.top>=top-1&&item.top<end)});top=end;
  }
  const pageWidth=twips(pageWidthMm),pageHeightTwips=twips(pageHeightMm);
  const children=[];
  pages.forEach((page,index)=>{
    children.push(new D.Paragraph({pageBreakBefore:index>0,spacing:{before:0,after:0,line:1},children:[new D.ImageRun({data:page.data,transformation:{width:pageWidthPx,height:page.height},altText:{title:`预览页面 ${index+1}`,description:'来自网页预览的页面图像；如需更改文字，请回到 Text to MD 编辑源文本。'}})]}));
    page.headings.forEach(heading=>children.push(new D.Paragraph({heading:D.HeadingLevel[`HEADING_${Math.min(heading.level,3)}`],keepNext:false,spacing:{before:0,after:0,line:1},children:[new D.TextRun({text:heading.text,vanish:true,specVanish:true,size:1,color:'FFFFFF'})]})));
  });
  const file=new D.Document({sections:[{properties:{page:{size:{width:pageWidth,height:pageHeightTwips},margin:{top:0,right:0,bottom:0,left:0}}},children}]});
  download(await D.Packer.toBlob(file),`${name}.docx`);
}
