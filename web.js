import {defaults, themes, clone} from './js/model.js';
import {parse, blockHtml} from './js/parser.js';
import * as out from './js/exporters.js';

const $ = s => document.querySelector(s);
const content = $('#content'), preview = $('#preview'), stage = $('#page-stage');
const status = $('#status'), count = $('#count'), toast = $('#toast'), previewPane = $('#preview-pane');
let doc={blocks:[]}, settings=clone(defaults), dirty=false, sourceDirty=false, pendingPreview=false;
let history=[], future=[], fileName='untitled';
const save=()=>localStorage.setItem('text-to-md-v2',JSON.stringify({text:content.value,doc,settings,fileName,dirty,sourceDirty}));
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
  dirty=false;sourceDirty=false;push();applySettings();
}
async function enhancePreview(){
  const math=[...preview.querySelectorAll('.math-block')];
  if(math.length)try{if(!window.katex){const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';document.head.append(css);await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)})}math.forEach(n=>window.katex.render(n.textContent,n,{throwOnError:false,displayMode:true}))}catch{notify('公式暂时以原始文本显示。')}
  const codes=[...preview.querySelectorAll('pre code')];
  if(codes.length)try{if(!window.hljs)await new Promise((ok,bad)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/highlight.js@11.10.0/lib/common.min.js';script.onload=ok;script.onerror=bad;document.head.append(script)});codes.forEach(n=>window.hljs.highlightElement(n))}catch{}
}
function format(force=false){
  if(dirty&&!force){pendingPreview=false;$('#reformat-dialog').showModal();return false}
  doc=parse(content.value);render();enhancePreview();setStatus('已按本地规则自动排版');notify('自动排版完成');return true;
}
function openPreview(){
  if(dirty){pendingPreview=true;$('#reformat-dialog').showModal();return}
  if(sourceDirty)format(true);
  previewPane.classList.add('visible');previewPane.setAttribute('aria-modal','true');document.body.classList.add('preview-open');
}
function closePreview(){previewPane.classList.remove('visible');previewPane.removeAttribute('aria-modal');document.body.classList.remove('preview-open');$('#open-preview').focus()}
function updateCount(){count.textContent=`${content.value.length.toLocaleString('zh-CN')} 字符`;save()}
function previewDoc(){return parse(preview.innerText)}
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

$('#auto-format').onclick=()=>format();$('#open-preview').onclick=openPreview;$('#editor-preview').onclick=openPreview;$('#close-preview').onclick=closePreview;
$('#confirm-reformat').onclick=()=>{const shouldOpen=pendingPreview;pendingPreview=false;if(format(true)&&shouldOpen){previewPane.classList.add('visible');previewPane.setAttribute('aria-modal','true');document.body.classList.add('preview-open')}};
$('#reformat-dialog').addEventListener('close',()=>{if($('#reformat-dialog').returnValue!=='reformat')pendingPreview=false});
$('#template-button').onclick=()=>panel('template');$('#style-button').onclick=()=>panel('style');$('#page-button').onclick=()=>panel('page');$('#close-panel').onclick=()=>$('#settings-panel').hidden=true;
$('#export-menu').onclick=()=>$('#export-popover').hidden=!$('#export-popover').hidden;
document.querySelectorAll('[data-export]').forEach(button=>button.onclick=async()=>{try{if(sourceDirty&&!dirty)format(true);const current=dirty?previewDoc():doc,kind=button.dataset.export;setStatus('正在准备导出…');if(kind==='md')out.markdown(current,fileName);if(kind==='docx')await out.docx(current,settings,fileName);if(kind==='pdf')out.pdf();if(kind==='png')await out.png(preview,fileName);setStatus('导出已准备完成');$('#export-popover').hidden=true}catch(error){console.error(error);notify('导出失败，请重试。');setStatus('导出失败')}});
content.addEventListener('input',()=>{sourceDirty=true;updateCount();setStatus('输入已更新，预览时将重新排版')});
preview.addEventListener('input',()=>{if(!dirty){push();dirty=true}save();setStatus('预览区已有未同步的手动修改')});
$('#file-input').onchange=async event=>{const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)return notify('文件超过 5MB，请拆分后导入。');try{content.value=await file.text();fileName=file.name.replace(/\.[^.]+$/,'');sourceDirty=true;updateCount();format(true)}catch{notify('文件读取失败，请确认编码后重试。')}};
document.querySelectorAll('.format-toolbar [data-command]').forEach(button=>button.onclick=()=>{preview.focus();document.execCommand(button.dataset.command,false,null)});
document.querySelectorAll('.format-toolbar [data-block]').forEach(button=>button.onclick=()=>{preview.focus();document.execCommand('formatBlock',false,button.dataset.block)});
$('[data-divider]').onclick=()=>{preview.focus();document.execCommand('insertHorizontalRule')};
$('#undo').onclick=()=>{if(history.length<2)return;future.push(history.pop());preview.innerHTML=history.at(-1);dirty=true;save()};
$('#redo').onclick=()=>{if(!future.length)return;const html=future.pop();history.push(html);preview.innerHTML=html;dirty=true;save()};
document.querySelectorAll('.preview-switch button').forEach(button=>button.onclick=()=>{settings.pageMode=button.dataset.pageMode;document.querySelectorAll('.preview-switch button').forEach(item=>item.classList.toggle('active',item===button));applySettings()});
$('#clear-local').onclick=()=>{if(confirm('确定清空当前浏览器保存的内容吗？')){localStorage.removeItem('text-to-md-v2');content.value='';doc={blocks:[]};sourceDirty=false;dirty=false;preview.innerHTML='<p class="empty-preview">还没有内容，先在输入区添加一些文字。</p>';updateCount();notify('本地内容已清空')}};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewPane.classList.contains('visible'))closePreview();if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();format()}if((event.metaKey||event.ctrlKey)&&event.key==='s'){event.preventDefault();if(sourceDirty&&!dirty)format(true);out.markdown(dirty?previewDoc():doc,fileName)}});
const cached=localStorage.getItem('text-to-md-v2');
if(cached)try{const saved=JSON.parse(cached);content.value=saved.text||'';doc=saved.doc||{blocks:[]};settings={...clone(defaults),...saved.settings};settings.fonts={...defaults.fonts,...saved.settings?.fonts};settings.sizes={...defaults.sizes,...saved.settings?.sizes};settings.paragraph={...defaults.paragraph,...saved.settings?.paragraph};settings.page={...defaults.page,...saved.settings?.page};fileName=saved.fileName||'untitled';dirty=Boolean(saved.dirty);sourceDirty=Boolean(saved.sourceDirty);const wasSourceDirty=sourceDirty;render();sourceDirty=wasSourceDirty;setStatus('已恢复本地草稿')}catch{}
applySettings();updateCount();
