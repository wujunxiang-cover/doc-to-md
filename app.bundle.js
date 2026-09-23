(()=>{
const defaults = { theme:'clean', pageMode:'continuous', fonts:{body:'Microsoft YaHei',heading:'Microsoft YaHei',latin:'Arial',code:'Menlo'}, sizes:{body:16,h1:32,h2:24,h3:19,code:13}, paragraph:{lineHeight:1.7,spacing:16}, page:{size:'A4',orientation:'portrait',margin:'normal'} };
const themes={clean:'简洁文档',business:'商务报告',academic:'学术文档',notion:'Notion 风格',github:'GitHub 风格'};
function emptyDocument(){return {blocks:[]};}
function clone(value){return JSON.parse(JSON.stringify(value));}

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => /^(https?:|mailto:|\/|#)/i.test(value.trim()) ? value.trim() : '#';

function inline(text) {
  const tokens = [];
  const hold = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let value = esc(text);
  value = value.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));
  value = value.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title='') => hold(`<img src="${esc(safeUrl(url))}" alt="${alt}" title="${title}">`));
  value = value.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title='') => hold(`<a href="${esc(safeUrl(url))}" title="${title}" target="_blank" rel="noopener">${label}</a>`));
  value = value.replace(/(^|\s)(https?:\/\/[^\s<]+)/g, (_, lead, url) => `${lead}${hold(`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener">${url}</a>`)}`);
  value = value.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/~~(.+?)~~/g, '<s>$1</s>').replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/\^([^\^\n]+)\^/g, '<sup>$1</sup>').replace(/(?<!~)~([^~\n]+)~(?!~)/g, '<sub>$1</sub>')
    .replace(/\$([^$\n]+)\$/g, '<span class="math">$1</span>')
    .replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_, a, b) => `<em>${a ?? b}</em>`);
  return value.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)]);
}

const divider = s => /^(?:[-*_]\s*){3,}$/.test(s) || /^(?:—|–|―|─|━){3,}$/.test(s);
const listMatch = s => s.match(/^\s*(?:[-+*•·●○▪▫☑✓□]\s+|\[[ xX]\]\s+)(.*)$/);
const orderedMatch = s => s.match(/^\s*(?:\d+[.)、．]|[（(]\d+[）)]|[０-９]+[.、．]|[①-⑳])\s*(.*)$/);
const tableCells = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));
const isTableRule = s => s.includes('|') && tableCells(s).length > 0 && tableCells(s).every(x => /^:?-{3,}:?$/.test(x));
function choiceParts(text) {
  const matches = [...text.matchAll(/(?:^|[\s　])([A-F])[.．、)]\s*/g)];
  if (matches.length < 2) return null;
  const labels = matches.map(match => match[1]);
  if (labels.some((label, index) => index && label.charCodeAt(0) !== labels[index - 1].charCodeAt(0) + 1)) return null;
  const first = matches[0], prefix = text.slice(0, first.index + first[0].length - first[1].length - 2).trim();
  const items = matches.map((match, index) => {
    const start = match.index + match[0].length;
    return text.slice(start, index + 1 < matches.length ? matches[index + 1].index : text.length).trim();
  });
  return {prefix, items};
}
const startsBlock = s => /^(?:```|~~~|\$\$|\\\[|#{1,6}\s|>\s?|[-+*•·●○▪▫☑✓□]\s+|\[[ xX]\]\s+|\d+[.)、．]\s+|[（(]\d+[）)]|[一二三四五六七八九十]+[、.．])/.test(s) || divider(s);

function parse(text) {
  const doc = emptyDocument(), lines = String(text).replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i], t = raw.trim();
    if (!t) { i++; continue; }
    let m;
    if (/^(?:```|~~~)/.test(t)) {
      const fence = t.slice(0, 3), language = t.slice(3).trim(), code = [];
      i++; while (i < lines.length && !lines[i].trim().startsWith(fence)) code.push(lines[i++]); if (i < lines.length) i++;
      doc.blocks.push({type:'codeBlock', language, content:code.join('\n')}); continue;
    }
    if (t === '$$' || t === '\\[') {
      const end = t === '$$' ? '$$' : '\\]'; let math = []; i++;
      while (i < lines.length && lines[i].trim() !== end) math.push(lines[i++]); if (i < lines.length) i++;
      doc.blocks.push({type:'mathBlock', content:math.join('\n')}); continue;
    }
    if ((m = t.match(/^(#{1,6})\s+(.+?)\s*#*$/))) { doc.blocks.push({type:'heading', level:Math.min(m[1].length,3), content:m[2]}); i++; continue; }
    if (i + 1 < lines.length && /^\s*(?:=+|-{3,})\s*$/.test(lines[i+1]) && t.length) {
      doc.blocks.push({type:'heading', level:lines[i+1].trim()[0] === '=' ? 1 : 2, content:t}); i += 2; continue;
    }
    if ((m = t.match(/^(?:第[一二三四五六七八九十百零〇\d]+[章节篇部]|[一二三四五六七八九十]+[、.．]|[（(][一二三四五六七八九十\d]+[）)]|\d+[、．])\s*(.+)$/))) {
      doc.blocks.push({type:'heading', level:1, content:t}); i++; continue;
    }
    if (divider(t)) { doc.blocks.push({type:'divider'}); i++; continue; }
    if (/^>/.test(t)) { const q=[]; while (i<lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/,'')); doc.blocks.push({type:'blockquote',content:q.join('\n')}); continue; }
    if (i+1<lines.length && t.includes('|') && isTableRule(lines[i+1])) {
      const header=tableCells(t); i+=2; const rows=[];
      while(i<lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(tableCells(lines[i++]));
      doc.blocks.push({type:'table',header,rows}); continue;
    }
    if (listMatch(t)) {
      const items=[]; while(i<lines.length && listMatch(lines[i].trim())) items.push(listMatch(lines[i++].trim())[1]);
      doc.blocks.push({type:'bulletList',items}); continue;
    }
    if (orderedMatch(t)) {
      const items=[]; while(i<lines.length && orderedMatch(lines[i].trim())) items.push(orderedMatch(lines[i++].trim())[1]);
      doc.blocks.push({type:'orderedList',items}); continue;
    }
    if (/^\s{4,}\S/.test(raw)) { const code=[]; while(i<lines.length && (/^\s{4,}\S/.test(lines[i]) || !lines[i].trim())) code.push(lines[i++].replace(/^ {4}/,'')); doc.blocks.push({type:'codeBlock',language:'',content:code.join('\n').trimEnd()}); continue; }
    const paragraph=[t]; i++;
    while(i<lines.length && lines[i].trim() && !startsBlock(lines[i].trim()) && !(i+1<lines.length && /^(?:=+|-{3,})$/.test(lines[i+1].trim()))) paragraph.push(lines[i++].trim());
    const content = paragraph.join('\n'), choices = choiceParts(content);
    if (choices) {
      if (choices.prefix) doc.blocks.push({type:'paragraph',content:choices.prefix});
      doc.blocks.push({type:'choiceList',items:choices.items});
    } else doc.blocks.push({type:'paragraph',content});
  }
  return doc;
}

function toMarkdown(doc) {
  return doc.blocks.map(b=>{
    if(b.type==='heading') return '#'.repeat(b.level)+' '+b.content;
    if(b.type==='paragraph') return b.content;
    if(b.type==='bulletList') return b.items.map(x=>'- '+x).join('\n');
    if(b.type==='orderedList') return b.items.map((x,i)=>`${i+1}. ${x}`).join('\n');
    if(b.type==='choiceList') return b.items.map((x,i)=>`${String.fromCharCode(65+i)}. ${x}`).join('\n');
    if(b.type==='blockquote') return b.content.split('\n').map(x=>'> '+x).join('\n');
    if(b.type==='codeBlock') return '```'+(b.language||'')+'\n'+b.content+'\n```';
    if(b.type==='mathBlock') return '$$\n'+b.content+'\n$$';
    if(b.type==='divider') return '---';
    if(b.type==='table') return '| '+b.header.join(' | ')+' |\n| '+b.header.map(()=>'---').join(' | ')+' |\n'+b.rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
    return '';
  }).join('\n\n')+'\n';
}

function blockHtml(b) {
  if(b.type==='heading') return `<h${b.level}>${inline(b.content)}</h${b.level}>`;
  if(b.type==='paragraph') return `<p>${inline(b.content).replace(/\n/g,'<br>')}</p>`;
  if(b.type==='bulletList') return '<ul>'+b.items.map(x=>`<li>${inline(x)}</li>`).join('')+'</ul>';
  if(b.type==='orderedList') return '<ol>'+b.items.map(x=>`<li>${inline(x)}</li>`).join('')+'</ol>';
  if(b.type==='choiceList') return '<ol class="choice-list" type="A">'+b.items.map(x=>`<li>${inline(x)}</li>`).join('')+'</ol>';
  if(b.type==='blockquote') return `<blockquote>${inline(b.content).replace(/\n/g,'<br>')}</blockquote>`;
  if(b.type==='codeBlock') return `<pre data-language="${esc(b.language||'')}"><code>${esc(b.content)}</code></pre>`;
  if(b.type==='mathBlock') return `<div class="math-block">${esc(b.content)}</div>`;
  if(b.type==='divider') return '<hr>';
  if(b.type==='table') return '<table><thead><tr>'+b.header.map(x=>`<th>${inline(x)}</th>`).join('')+'</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+b.header.map((_,i)=>`<td>${inline(r[i]||'')}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  return '';
}

const download=(blob,name)=>{const u=URL.createObjectURL(blob),a=Object.assign(document.createElement('a'),{href:u,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(u),300);};
const load=src=>new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`))return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('资源加载失败'));document.head.append(s);});
function markdown(doc,name){download(new Blob([toMarkdown(doc)],{type:'text/markdown;charset=utf-8'}),`${name}.md`);}
async function png(node,name){await load('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');const canvas=await window.html2canvas(node,{scale:2,backgroundColor:'#ffffff',useCORS:true});canvas.toBlob(b=>download(b,`${name}.png`),'image/png');}
function pdf(){window.print();}

const COLORS={ink:'243247',muted:'5F6B7B',accent:'5967C8',pale:'F2F4FC',line:'DCE2EE',code:'F4F6F8',white:'FFFFFF'};
function runs(text,D,settings,base={}){
  const result=[], pattern=/\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_|==(.+?)==/g;
  let last=0,match;
  const add=(value,options={})=>{if(value)result.push(new D.TextRun({text:value,font:{ascii:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei',hAnsi:settings.fonts.latin||'Arial'},size:Math.round(settings.sizes.body*1.5),color:COLORS.ink,...base,...options}));};
  while((match=pattern.exec(text))){add(text.slice(last,match.index));const value=match.slice(1).find(part=>part!==undefined)||'';const opts=match[1]||match[2]?{bold:true}:match[3]?{strike:true}:match[4]?{font:{ascii:settings.fonts.code||'Consolas',eastAsia:settings.fonts.code||'Consolas'},shading:{fill:'E8ECF3'},size:Math.round(settings.sizes.code*1.5)}:match[5]||match[6]?{italics:true}:{highlight:'FFF1B8'};add(value,opts);last=pattern.lastIndex;}
  add(text.slice(last));return result.length?result:[new D.TextRun('')];
}
function para(D,text,settings,options={}){return new D.Paragraph({children:runs(text,D,settings,options.run||{}),...options});}
function cell(D,text,settings,header=false){return new D.TableCell({children:[new D.Paragraph({children:runs(text,D,settings,{bold:header,color:header?COLORS.white:COLORS.ink}),spacing:{before:50,after:50,line:300}})],shading:{fill:header?COLORS.accent:COLORS.white},margins:{top:100,bottom:100,left:120,right:120},verticalAlign:'center'});}

async function docx(doc,settings,name){
  await load('https://unpkg.com/docx@8.5.0/build/index.umd.js');
  const D=window.docx;if(!D)throw new Error('Word 导出组件加载失败');
  if(/Mac|iPhone|iPad/i.test(navigator.platform)&&settings.fonts.body==='Microsoft YaHei') settings={...settings,fonts:{...settings.fonts,body:'PingFang SC'}};
  const children=[];
  for(const block of doc.blocks){
    const text=block.content||'';
    if(block.type==='heading'){
      const level=Math.min(block.level||1,3), sizes={1:34,2:28,3:23};
      children.push(new D.Paragraph({heading:`HEADING_${level}`,keepNext:true,spacing:{before:level===1?360:260,after:150,line:360},children:runs(text,D,settings,{bold:true,color:COLORS.ink,size:sizes[level]} )}));
    }else if(block.type==='paragraph'){
      children.push(para(D,text,settings,{spacing:{after:150,line:360},alignment:D.AlignmentType.JUSTIFIED}));
    }else if(block.type==='bulletList'||block.type==='orderedList'){
      block.items.forEach((item,index)=>children.push(new D.Paragraph({children:runs(item,D,settings),bullet:block.type==='bulletList'?{level:0}:undefined,numbering:block.type==='orderedList'?{reference:'main',level:0}:undefined,indent:{left:480,hanging:240},spacing:{after:90,line:330},keepLines:true})))
    }else if(block.type==='choiceList'){
      block.items.forEach((item,index)=>children.push(new D.Paragraph({children:[new D.TextRun({text:`${String.fromCharCode(65+index)}.`,bold:true,color:COLORS.accent,font:{ascii:'Arial',eastAsia:'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5)}),new D.TextRun({text:`  ${item}`,font:{ascii:settings.fonts.latin||'Arial',eastAsia:settings.fonts.body||'Microsoft YaHei'},size:Math.round(settings.sizes.body*1.5),color:COLORS.ink})],indent:{left:420,hanging:420},spacing:{after:80,line:330},keepLines:true})))
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

const out={markdown,png,pdf,docx};
const $ = s => document.querySelector(s);
const content = $('#content'), preview = $('#preview'), stage = $('#page-stage');
const status = $('#status'), count = $('#count'), toast = $('#toast'), previewPane = $('#preview-pane');
let doc={blocks:[]}, settings=clone(defaults), sourceDirty=false;
let history=[], future=[], fileName='untitled';
const save=()=>{try{localStorage.setItem('text-to-md-v2',JSON.stringify({text:content.value,doc,settings,fileName,sourceDirty}))}catch{status.textContent='浏览器禁用了本地保存；当前页面仍可正常使用'}};
function notify(message){toast.textContent=message;toast.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.hidden=true,2600)}
function setStatus(message){status.textContent=message}
window.addEventListener('error',event=>{if(event.message)setStatus(`页面脚本错误：${event.message}`)});
window.addEventListener('unhandledrejection',event=>{const reason=event.reason?.message||'未知错误';setStatus(`操作未完成：${reason}`)});
function push(){history.push(preview.innerHTML);if(history.length>40)history.shift();future=[]}
function applySettings(){
  const root=document.documentElement.style;
  root.setProperty('--body-font',`"${settings.fonts.body}","PingFang SC",sans-serif`);
  root.setProperty('--heading-font',`"${settings.fonts.heading}","PingFang SC",sans-serif`);
  root.setProperty('--code-font',`${settings.fonts.code},monospace`);
  for(const [key,value] of Object.entries(settings.sizes)) root.setProperty(`--${key==='body'?'body-size':key+'-size'}`,value+'px');
  root.setProperty('--line-height',settings.paragraph.lineHeight);root.setProperty('--paragraph-space',settings.paragraph.spacing+'px');
  preview.className=`document theme-${settings.theme}`;stage.className=`page-stage ${settings.pageMode}`;
  $('#template-name').textContent=themes[settings.theme];$('#page-name').textContent=`${settings.page.size} · ${settings.page.orientation==='portrait'?'纵向':'横向'}`;save();
}
function render(){
  preview.innerHTML=doc.blocks.length?doc.blocks.map(blockHtml).join(''):'<p class="empty-preview">还没有内容，先在输入区添加一些文字。</p>';
  sourceDirty=false;history=[];future=[];push();applySettings();
}
async function enhancePreview(){
  const math=[...preview.querySelectorAll('.math-block')];
  if(math.length)try{if(!window.katex){const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';document.head.append(css);await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)})}math.forEach(n=>window.katex.render(n.textContent,n,{throwOnError:false,displayMode:true}))}catch{notify('公式暂时以原始文本显示。')}
  const codes=[...preview.querySelectorAll('pre code')];
  if(codes.length)try{if(!window.hljs)await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/build/highlight.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)});codes.forEach(n=>window.hljs.highlightElement(n))}catch{}
}
function format(){
  doc=parse(content.value);content.value=toMarkdown(doc).trimEnd();doc=parse(content.value);updateCount();render();enhancePreview();setStatus('已按本地规则自动排版；输入框已更新为整理后的 Markdown');notify('排版完成，输入框已更新，可继续编辑或删除');return true;
}
function openPreview(){
  if(sourceDirty)format();
  previewPane.classList.add('visible');previewPane.setAttribute('aria-modal','true');document.body.classList.add('preview-open');
}
function closePreview(){previewPane.classList.remove('visible');previewPane.removeAttribute('aria-modal');document.body.classList.remove('preview-open');$('#open-preview').focus()}
function updateCount(){count.textContent=`${content.value.length.toLocaleString('zh-CN')} 字符`;save()}
function escapeMarkdown(value){return value.replace(/\\/g,'\\\\').replace(/([`*_{}\[\]<>])/g,'\\$1')}
function inlineMarkdown(node){
  if(node.nodeType===Node.TEXT_NODE)return escapeMarkdown(node.nodeValue||'');
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const tag=node.tagName.toLowerCase(),children=[...node.childNodes].map(inlineMarkdown).join('');
  if(tag==='br')return '\n';if(tag==='img')return `![${escapeMarkdown(node.alt||'')}](${node.getAttribute('src')||''})`;
  if(tag==='a')return `[${children}](${node.getAttribute('href')||''})`;
  if(tag==='strong'||tag==='b')return `**${children}**`;if(tag==='em'||tag==='i')return `*${children}*`;
  if(tag==='s'||tag==='del'||tag==='strike')return `~~${children}~~`;if(tag==='sup')return `^${children}^`;if(tag==='sub')return `~${children}~`;
  if(tag==='mark')return `==${children}==`;if(tag==='code'&&node.parentElement?.tagName!=='PRE')return `\`${node.textContent}\``;
  if(node.classList.contains('math'))return `$${node.textContent}$`;
  return children;
}
function serializePreview(){
  return [...preview.children].map(node=>{
    const tag=node.tagName.toLowerCase(),text=[...node.childNodes].map(inlineMarkdown).join('').trim();
    if(/^h[1-6]$/.test(tag))return `${'#'.repeat(Number(tag[1]))} ${text}`;
    if(tag==='p')return text;
    if(tag==='blockquote')return text.split('\n').map(line=>`> ${line}`).join('\n');
    if(tag==='ul'||tag==='ol')return [...node.children].map((item,index)=>`${tag==='ul'?'-':node.classList.contains('choice-list')?`${String.fromCharCode(65+index)}.`:`${index+1}.`} ${[...item.childNodes].map(inlineMarkdown).join('').trim()}`).join('\n');
    if(tag==='pre')return `\`\`\`${node.dataset.language||''}\n${node.textContent}\n\`\`\``;
    if(tag==='hr')return '---';
    if(tag==='table'){
      const rows=[...node.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>[...cell.childNodes].map(inlineMarkdown).join('').replace(/\|/g,'\\|')));
      return rows.length?`| ${rows[0].join(' | ')} |\n| ${rows[0].map(()=> '---').join(' | ')} |${rows.slice(1).map(row=>`\n| ${row.join(' | ')} |`).join('')}`:'';
    }
    if(node.classList.contains('math-block'))return `$$\n${node.textContent}\n$$`;
    return text;
  }).filter(Boolean).join('\n\n');
}
function previewDoc(){return parse(serializePreview())}
function syncPreview(){
  doc=previewDoc();content.value=toMarkdown(doc).trimEnd();sourceDirty=false;updateCount();setStatus('预览修改已同步到输入框');
}
function panel(kind){
  const title=$('#panel-title'),box=$('#panel-content');$('#settings-panel').hidden=false;
  if(kind==='template'){
    title.textContent='选择模板';box.innerHTML=`<div class="template-list">${Object.entries(themes).map(([k,v])=>`<button class="${k===settings.theme?'active':''}" data-theme="${k}">${v}</button>`).join('')}</div>`;
    box.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.theme;applySettings();panel('template')});return;
  }
  if(kind==='page'){
    title.textContent='页面设置';box.innerHTML=`<div class="setting-group"><h3>纸张与方向</h3><div class="setting-grid"><label>页面尺寸<select data-set="page.size"><option>A4</option><option>Letter</option></select></label><label>方向<select data-set="page.orientation"><option value="portrait">纵向</option><option value="landscape">横向</option></select></label></div></div><div class="setting-group"><h3>页边距</h3><div class="preset-list"><button data-margin="narrow">窄</button><button data-margin="normal">标准</button><button data-margin="wide">宽</button></div></div>`;
  }else{
    title.textContent='排版设置';box.innerHTML=`<div class="setting-group"><h3>字体预设</h3><div class="preset-list"><button data-preset="office">办公文档</button><button data-preset="paper">论文</button><button data-preset="report">正式报告</button><button data-preset="reading">阅读</button></div></div><div class="setting-group"><h3>字体</h3><div class="setting-grid"><label>正文<select data-set="fonts.body"><option>Microsoft YaHei</option><option>SimSun</option><option>SimHei</option><option>KaiTi</option><option>PingFang SC</option></select></label><label>标题<select data-set="fonts.heading"><option>Microsoft YaHei</option><option>SimHei</option><option>SimSun</option></select></label><label>英文<select data-set="fonts.latin"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Georgia</option></select></label><label>代码<select data-set="fonts.code"><option>Menlo</option><option>Consolas</option><option>Courier New</option><option>Monaco</option></select></label></div></div><div class="setting-group"><h3>字号与间距</h3><div class="setting-grid">${[['body','正文'],['h1','H1'],['h2','H2'],['h3','H3'],['code','代码']].map(([k,n])=>`<label>${n}<input type="number" min="10" max="56" data-set="sizes.${k}" value="${settings.sizes[k]}"></label>`).join('')}<label>行距<input type="number" step=".1" min="1" max="3" data-set="paragraph.lineHeight" value="${settings.paragraph.lineHeight}"></label><label>段距<input type="number" min="0" max="48" data-set="paragraph.spacing" value="${settings.paragraph.spacing}"></label></div></div>`;
  }
  box.querySelectorAll('[data-set]').forEach(el=>{const path=el.dataset.set.split('.');let target=settings;path.slice(0,-1).forEach(k=>target=target[k]);el.value=target[path.at(-1)];el.oninput=()=>{target[path.at(-1)]=el.type==='number'?Number(el.value):el.value;applySettings()}});
  box.querySelectorAll('[data-margin]').forEach(b=>b.onclick=()=>{settings.page.margin=b.dataset.margin;document.documentElement.style.setProperty('--content-padding',({narrow:'30px',normal:'48px',wide:'72px'})[b.dataset.margin]);applySettings()});
  box.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const fonts={office:['Microsoft YaHei','Arial','Consolas'],paper:['SimSun','Times New Roman','Courier New'],report:['SimHei','Calibri','Consolas'],reading:['PingFang SC','Georgia','Menlo']}[b.dataset.preset];[settings.fonts.body,settings.fonts.latin,settings.fonts.code]=fonts;settings.fonts.heading=fonts[0];applySettings();panel('style')});
}

$('#auto-format').onclick=()=>format();$('#open-preview').onclick=openPreview;$('#close-preview').onclick=closePreview;
$('#template-button').onclick=()=>panel('template');$('#style-button').onclick=()=>panel('style');$('#page-button').onclick=()=>panel('page');$('#close-panel').onclick=()=>$('#settings-panel').hidden=true;
$('#export-menu').onclick=()=>$('#export-popover').hidden=!$('#export-popover').hidden;
document.querySelectorAll('[data-export]').forEach(button=>button.onclick=async()=>{try{if(sourceDirty)format();const kind=button.dataset.export;setStatus('正在准备导出…');if(kind==='md')out.markdown(doc,fileName);if(kind==='docx')await out.docx(doc,settings,fileName);if(kind==='pdf')out.pdf();if(kind==='png')await out.png(preview,fileName);setStatus('导出已准备完成');$('#export-popover').hidden=true}catch(error){console.error(error);notify('导出失败，请重试。');setStatus('导出失败')}});
content.addEventListener('input',()=>{sourceDirty=true;updateCount();setStatus('输入已更新，预览时将重新排版')});
preview.addEventListener('input',()=>{if(history.at(-1)!==preview.innerHTML){history.push(preview.innerHTML);if(history.length>40)history.shift();future=[]}syncPreview()});
$('#file-input').onchange=async event=>{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)return notify('文件超过 5MB，请拆分后导入。');try{content.value=await file.text();fileName=file.name.replace(/\.[^.]+$/,'');sourceDirty=true;updateCount();format()}catch{notify('文件读取失败，请确认编码后重试。')}};
document.querySelectorAll('.format-toolbar [data-command]').forEach(button=>button.onclick=()=>{preview.focus();document.execCommand(button.dataset.command,false,null)});
document.querySelectorAll('.format-toolbar [data-block]').forEach(button=>button.onclick=()=>{preview.focus();document.execCommand('formatBlock',false,button.dataset.block)});
$('[data-divider]').onclick=()=>{preview.focus();document.execCommand('insertHorizontalRule')};
$('#undo').onclick=()=>{if(history.length<2)return;future.push(history.pop());preview.innerHTML=history.at(-1);syncPreview()};
$('#redo').onclick=()=>{if(!future.length)return;const html=future.pop();history.push(html);preview.innerHTML=html;syncPreview()};
document.querySelectorAll('.preview-switch button').forEach(button=>button.onclick=()=>{settings.pageMode=button.dataset.pageMode;document.querySelectorAll('.preview-switch button').forEach(item=>item.classList.toggle('active',item===button));applySettings()});
$('#clear-local').onclick=()=>{if(confirm('确定清空当前浏览器保存的内容吗？')){try{localStorage.removeItem('text-to-md-v2')}catch{}content.value='';doc={blocks:[]};sourceDirty=false;preview.innerHTML='<p class="empty-preview">还没有内容，先在输入区添加一些文字。</p>';updateCount();notify('本地内容已清空')}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewPane.classList.contains('visible'))closePreview();if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();format()}if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(sourceDirty)format();out.markdown(doc,fileName)}});
let cached=null;try{cached=localStorage.getItem('text-to-md-v2')}catch{}
if(cached)try{const saved=JSON.parse(cached);content.value=saved.text||'';doc=saved.doc||{blocks:[]};settings={...clone(defaults),...saved.settings};settings.fonts={...defaults.fonts,...saved.settings?.fonts};settings.sizes={...defaults.sizes,...saved.settings?.sizes};settings.paragraph={...defaults.paragraph,...saved.settings?.paragraph};settings.page={...defaults.page,...saved.settings?.page};fileName=saved.fileName||'untitled';sourceDirty=Boolean(saved.sourceDirty);render();sourceDirty=Boolean(saved.sourceDirty);setStatus('已恢复本地草稿')}catch{}
applySettings();updateCount();

})();
