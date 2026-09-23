import {defaults, themes, clone} from './js/model.js';
import {parse, blockHtml, toMarkdown} from './js/parser.js';
import * as out from './js/exporters.js';

const $ = s => document.querySelector(s);
if(!document.querySelector('link[rel="icon"]')){const icon=document.createElement('link');icon.rel='icon';icon.href='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"%3E%3Crect width="40" height="40" rx="10" fill="%23655de0"/%3E%3Ctext x="20" y="28" text-anchor="middle" font-size="28" fill="white"%3E%E2%9C%B3%3C/text%3E%3C/svg%3E';document.head.append(icon)}
const content = $('#content'), preview = $('#preview'), stage = $('#page-stage');
const status = $('#status'), count = $('#count'), toast = $('#toast'), previewPane = $('#preview-pane');
let doc={blocks:[]}, settings=clone(defaults), sourceDirty=false;
let history=[], future=[], fileName='untitled';
let selectedDirectory=null;
const exportDialog=$('#export-dialog'), exportName=$('#export-name'), exportFormat=$('#export-format');
const settingsAction=document.createElement('button');settingsAction.id='preview-settings';settingsAction.className='close-preview';settingsAction.textContent='样式与页面';$('.preview-controls').prepend(settingsAction);
const exportAction=$('#export-menu'), exportHome=exportAction.parentElement;
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
  root.setProperty('--letter-spacing',`${settings.paragraph.letterSpacing||0}px`);
  root.setProperty('--first-line-indent',`${settings.paragraph.firstLineIndent||0}em`);
  root.setProperty('--list-indent',`${settings.list.indent}px`);root.setProperty('--list-item-space',`${settings.list.spacing}px`);
  for(const level of ['h1','h2','h3']){const style=settings.headings[level];root.setProperty(`--${level}-weight`,style.bold?'750':'500');root.setProperty(`--${level}-align`,style.align);root.setProperty(`--${level}-before`,`${style.before}px`);root.setProperty(`--${level}-after`,`${style.after}px`)}
  root.setProperty('--content-padding',({narrow:'38px',normal:'57px',wide:'76px'})[settings.page.margin]||'57px');
  const letter=settings.page.size==='Letter',size=letter?{width:816,height:1056}:{width:794,height:1123};
  if(settings.page.orientation==='landscape')[size.width,size.height]=[size.height,size.width];
  root.setProperty('--page-width',size.width+'px');root.setProperty('--page-height',size.height+'px');
  preview.className=`document theme-${settings.theme}`;stage.className=`page-stage ${settings.pageMode}`;
  const templateName=$('#template-name'),pageName=$('#page-name');if(templateName)templateName.textContent=themes[settings.theme];if(pageName)pageName.textContent=`${settings.page.size} · ${settings.page.orientation==='portrait'?'纵向':'横向'}`;save();
}
function render(){
  preview.innerHTML=doc.blocks.length?doc.blocks.map(blockHtml).join(''):'<p class="empty-preview">还没有内容，先在输入区添加一些文字。</p>';
  sourceDirty=false;history=[];future=[];push();applySettings();
}
async function enhancePreview(){
  const math=[...preview.querySelectorAll('.math,.math-block')].filter(node=>!node.dataset.rendered);
  if(math.length)try{if(!window.katex){const css=document.createElement('link');css.rel='stylesheet';css.href='./vendor/katex/katex.min.css';document.head.append(css);await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='./vendor/katex/katex.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)})}math.forEach(node=>{const formula=node.dataset.tex||node.textContent;node.dataset.tex=formula;window.katex.render(formula,node,{throwOnError:false,displayMode:node.classList.contains('math-block')});node.dataset.rendered='true'})}catch{notify('公式暂时以原始文本显示。')}
  const codes=[...preview.querySelectorAll('pre code')];
  if(codes.length)try{if(!window.hljs)await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/build/highlight.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)});codes.forEach(n=>window.hljs.highlightElement(n))}catch{}
}
function format(){
  doc=parse(content.value);content.value=toMarkdown(doc).trimEnd();doc=parse(content.value);updateCount();render();enhancePreview();setStatus('已按本地规则自动排版；输入框已更新为整理后的 Markdown');notify('排版完成，输入框已更新，可继续编辑或删除');return true;
}
function openPreview(){
  if(sourceDirty)format();
  $('.preview-controls').insertBefore(exportAction,$('#close-preview'));
  previewPane.classList.add('visible');previewPane.setAttribute('aria-modal','true');document.body.classList.add('preview-open');
}
function closePreview(){previewPane.classList.remove('visible');previewPane.removeAttribute('aria-modal');document.body.classList.remove('preview-open');exportHome.append(exportAction);$('#open-preview').focus()}
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
  if(node.classList.contains('math'))return `\\(${node.dataset.tex||node.textContent}\\)`;
  return children;
}
function serializePreview(){
  return [...preview.children].map(node=>{
    const tag=node.tagName.toLowerCase(),text=[...node.childNodes].map(inlineMarkdown).join('').trim();
    if(/^h[1-6]$/.test(tag))return `${'#'.repeat(Number(tag[1]))} ${text}`;
    if(tag==='p')return text;
    if(tag==='blockquote')return text.split('\n').map(line=>`> ${line}`).join('\n');
    if(tag==='ul'||tag==='ol')return [...node.children].map((item,index)=>{const body=[...item.childNodes].filter(child=>!(child.nodeType===Node.ELEMENT_NODE&&child.classList.contains('list-marker'))).map(inlineMarkdown).join('').trim();return `${tag==='ul'?'-':node.classList.contains('choice-list')?`${String.fromCharCode(65+index)}.`:`${index+1}.`} ${body}`}).join('\n');
    if(tag==='pre')return `\`\`\`${node.dataset.language||''}\n${node.textContent}\n\`\`\``;
    if(tag==='hr')return '---';
    if(tag==='table'){
      const rows=[...node.querySelectorAll('tr')].map(row=>[...row.children].map(cell=>[...cell.childNodes].map(inlineMarkdown).join('').replace(/\|/g,'\\|')));
      return rows.length?`| ${rows[0].join(' | ')} |\n| ${rows[0].map(()=> '---').join(' | ')} |${rows.slice(1).map(row=>`\n| ${row.join(' | ')} |`).join('')}`:'';
    }
    if(node.classList.contains('math-block'))return `$$\n${node.dataset.tex||node.textContent}\n$$`;
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
    title.textContent='样式与排版';
    box.innerHTML=`<div class="setting-group"><h3>文档风格</h3><div class="template-list">${Object.entries(themes).map(([key,label])=>`<button class="${key===settings.theme?'active':''}" data-theme="${key}">${label}</button>`).join('')}</div></div><div class="setting-group"><h3>自定义风格</h3><div class="preset-list"><button id="save-custom-style">保存当前设置为风格</button><div id="custom-style-list"></div></div></div><div class="setting-group"><h3>字体</h3><div class="setting-grid"><label>正文<select data-set="fonts.body"><option>Microsoft YaHei</option><option>SimSun</option><option>SimHei</option><option>KaiTi</option><option>PingFang SC</option></select></label><label>标题<select data-set="fonts.heading"><option>Microsoft YaHei</option><option>SimHei</option><option>SimSun</option></select></label><label>英文<select data-set="fonts.latin"><option>Arial</option><option>Calibri</option><option>Times New Roman</option><option>Georgia</option></select></label><label>代码<select data-set="fonts.code"><option>Menlo</option><option>Consolas</option><option>Courier New</option><option>Monaco</option></select></label></div></div><div class="setting-group"><h3>字号与段落</h3><div class="setting-grid">${[['body','正文'],['h1','一级标题'],['h2','二级标题'],['h3','三级标题'],['code','代码']].map(([key,label])=>`<label>${label}<input type="number" min="10" max="56" data-set="sizes.${key}" value="${settings.sizes[key]}"></label>`).join('')}<label>行距<input type="number" step=".1" min="1" max="3" data-set="paragraph.lineHeight" value="${settings.paragraph.lineHeight}"></label><label>段后距<input type="number" min="0" max="48" data-set="paragraph.spacing" value="${settings.paragraph.spacing}"></label><label>首行缩进（字符）<input type="number" min="0" max="4" step=".5" data-set="paragraph.firstLineIndent" value="${settings.paragraph.firstLineIndent}"></label><label>字间距（px）<input type="number" min="-1" max="4" step=".1" data-set="paragraph.letterSpacing" value="${settings.paragraph.letterSpacing}"></label></div></div>${['h1','h2','h3'].map((level,index)=>{const label=['一级标题','二级标题','三级标题'][index],style=settings.headings[level];return `<div class="setting-group"><h3>${label}</h3><div class="setting-grid"><label><input type="checkbox" data-set="headings.${level}.bold" ${style.bold?'checked':''}> 加粗</label><label>对齐<select data-set="headings.${level}.align"><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label><label>段前距（px）<input type="number" min="0" max="80" data-set="headings.${level}.before" value="${style.before}"></label><label>段后距（px）<input type="number" min="0" max="60" data-set="headings.${level}.after" value="${style.after}"></label></div></div>`}).join('')}<div class="setting-group"><h3>列表</h3><div class="setting-grid"><label>缩进（px）<input type="number" min="0" max="100" data-set="list.indent" value="${settings.list.indent}"></label><label>项目间距（px）<input type="number" min="0" max="32" data-set="list.spacing" value="${settings.list.spacing}"></label></div></div><div class="setting-group"><h3>页面</h3><div class="setting-grid"><label>纸张<select data-set="page.size"><option>A4</option><option>Letter</option></select></label><label>方向<select data-set="page.orientation"><option value="portrait">纵向</option><option value="landscape">横向</option></select></label><label>页边距<select data-set="page.margin"><option value="narrow">窄</option><option value="normal">标准</option><option value="wide">宽</option></select></label></div></div>`;
  }
  box.querySelectorAll('[data-set]').forEach(el=>{const path=el.dataset.set.split('.');let target=settings;path.slice(0,-1).forEach(k=>target=target[k]);if(el.type==='checkbox')el.checked=target[path.at(-1)];else el.value=target[path.at(-1)];el.oninput=()=>{target[path.at(-1)]=el.type==='number'?Number(el.value):el.type==='checkbox'?el.checked:el.value;applySettings()}});
  box.querySelectorAll('[data-margin]').forEach(b=>b.onclick=()=>{settings.page.margin=b.dataset.margin;document.documentElement.style.setProperty('--content-padding',({narrow:'30px',normal:'48px',wide:'72px'})[b.dataset.margin]);applySettings()});
  box.querySelectorAll('[data-theme]').forEach(button=>button.onclick=()=>{
    settings.theme=button.dataset.theme;
    const presets={academic:{body:'SimSun',heading:'SimHei',sizes:{body:15,h1:30,h2:23,h3:18},lineHeight:1.75,spacing:16},study:{body:'Microsoft YaHei',heading:'Microsoft YaHei',sizes:{body:16,h1:30,h2:23,h3:18},lineHeight:1.65,spacing:12},official:{body:'SimSun',heading:'SimHei',sizes:{body:16,h1:30,h2:24,h3:18},lineHeight:1.7,spacing:14},modern:{body:'PingFang SC',heading:'PingFang SC',sizes:{body:16,h1:32,h2:24,h3:19},lineHeight:1.75,spacing:18},report:{body:'Microsoft YaHei',heading:'SimHei',sizes:{body:16,h1:30,h2:23,h3:18},lineHeight:1.7,spacing:16},business:{body:'Microsoft YaHei',heading:'Microsoft YaHei',sizes:{body:16,h1:30,h2:23,h3:18},lineHeight:1.65,spacing:14},clean:{body:'Microsoft YaHei',heading:'Microsoft YaHei',sizes:{body:16,h1:32,h2:24,h3:19},lineHeight:1.7,spacing:16},notion:{body:'Microsoft YaHei',heading:'Microsoft YaHei',sizes:{body:16,h1:32,h2:24,h3:19},lineHeight:1.8,spacing:18},github:{body:'Microsoft YaHei',heading:'Microsoft YaHei',sizes:{body:16,h1:30,h2:23,h3:18},lineHeight:1.7,spacing:16}}[settings.theme];
    settings.fonts.body=presets.body;settings.fonts.heading=presets.heading;Object.assign(settings.sizes,presets.sizes);settings.paragraph.lineHeight=presets.lineHeight;settings.paragraph.spacing=presets.spacing;applySettings();panel('style');
  });
  box.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const fonts={office:['Microsoft YaHei','Arial','Consolas'],paper:['SimSun','Times New Roman','Courier New'],report:['SimHei','Calibri','Consolas'],reading:['PingFang SC','Georgia','Menlo']}[b.dataset.preset];[settings.fonts.body,settings.fonts.latin,settings.fonts.code]=fonts;settings.fonts.heading=fonts[0];applySettings();panel('style')});
  const savedStyles=()=>{try{return JSON.parse(localStorage.getItem('text-to-md-custom-styles')||'[]')}catch{return []}};
  const styleList=box.querySelector('#custom-style-list');
  if(styleList){styleList.replaceChildren();const items=savedStyles();if(!items.length){const note=document.createElement('small');note.className='muted-note';note.textContent='保存的风格会留在此浏览器。';styleList.append(note)}items.forEach((item,index)=>{const button=document.createElement('button');button.type='button';button.dataset.customStyle=String(index);button.textContent=item.name;styleList.append(button)})}
  box.querySelector('#save-custom-style')?.addEventListener('click',()=>{const name=prompt('给这套风格起个名字：');if(!name?.trim())return;const items=savedStyles();items.push({name:name.trim().slice(0,40),settings:clone(settings)});localStorage.setItem('text-to-md-custom-styles',JSON.stringify(items));panel('style');notify('自定义风格已保存到本机')});
  box.querySelectorAll('[data-custom-style]').forEach(button=>button.onclick=()=>{const item=savedStyles()[Number(button.dataset.customStyle)];if(item){settings={...clone(defaults),...item.settings,fonts:{...defaults.fonts,...item.settings.fonts},sizes:{...defaults.sizes,...item.settings.sizes},paragraph:{...defaults.paragraph,...item.settings.paragraph},headings:Object.fromEntries(['h1','h2','h3'].map(level=>[level,{...defaults.headings[level],...item.settings.headings?.[level]}])),list:{...defaults.list,...item.settings.list},page:{...defaults.page,...item.settings.page}};applySettings();panel('style')}});
}

$('#open-preview').onclick=openPreview;$('#close-preview').onclick=closePreview;
$('#close-panel').onclick=()=>$('#settings-panel').hidden=true;
$('#preview-settings').onclick=()=>panel('style');
$('#export-menu').onclick=()=>{if(sourceDirty)format();exportName.value=fileName==='untitled'?'自动排版':fileName;exportDialog.showModal()};
$('#choose-folder').onclick=async()=>{
  if(!window.showDirectoryPicker){$('#folder-support').textContent='当前浏览器不支持选择文件夹，将使用浏览器默认下载位置。';return notify('此浏览器不支持选择保存文件夹。')}
  try{selectedDirectory=await window.showDirectoryPicker({mode:'readwrite'});$('#save-location-label').textContent=selectedDirectory.name;$('#folder-support').textContent='已授权保存到所选文件夹。'}catch(error){if(error.name!=='AbortError')notify('无法访问所选文件夹，请检查浏览器权限。')}
};
$('#confirm-export').onclick=async event=>{
  event.preventDefault();const button=event.currentTarget,kind=exportFormat.value,name=(exportName.value.trim()||'自动排版').replace(/[\\/:*?"<>|]/g,'-');
  const extension={docx:'docx',md:'md',png:'zip'}[kind];button.disabled=true;setStatus('正在准备导出…');
  try{
    if(sourceDirty)format();fileName=name;
    if(kind==='pdf'){exportDialog.close();out.pdf(name,settings);setStatus('已打开浏览器 PDF 打印窗口');return}
    const blob=kind==='docx'?await out.docx(doc,settings,name):kind==='md'?out.markdown(doc):await out.png(preview,name,settings);
    const saved=await out.saveAs(blob,`${name}.${extension}`,selectedDirectory);
    exportDialog.close();setStatus(saved==='folder'?'已保存到所选文件夹':'已发送到浏览器下载');notify(saved==='folder'?'文档已保存到所选文件夹':'导出完成，文件在浏览器下载目录');
  }catch(error){console.error(error);notify(error.message||'导出失败，请重试。');setStatus('导出失败')}
  finally{button.disabled=false}
};
let parseTimer;
content.addEventListener('input',()=>{sourceDirty=true;updateCount();setStatus('正在识别文档结构…');clearTimeout(parseTimer);parseTimer=setTimeout(()=>{doc=parse(content.value);if(previewPane.classList.contains('visible')){render();enhancePreview()}setStatus('文本结构已更新，可打开预览检查')},220)});
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
if(cached)try{const saved=JSON.parse(cached);content.value=saved.text||'';doc=saved.doc||{blocks:[]};settings={...clone(defaults),...saved.settings};settings.fonts={...defaults.fonts,...saved.settings?.fonts};settings.sizes={...defaults.sizes,...saved.settings?.sizes};settings.paragraph={...defaults.paragraph,...saved.settings?.paragraph};settings.headings=Object.fromEntries(['h1','h2','h3'].map(level=>[level,{...defaults.headings[level],...saved.settings?.headings?.[level]}]));settings.list={...defaults.list,...saved.settings?.list};settings.page={...defaults.page,...saved.settings?.page};fileName=saved.fileName||'untitled';sourceDirty=Boolean(saved.sourceDirty);render();sourceDirty=Boolean(saved.sourceDirty);setStatus('已恢复本地草稿')}catch{}
applySettings();updateCount();
