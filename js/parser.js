import { emptyDocument, formatListNumber } from './model.js';
import { detectHeading, isNumberedQuestion } from './structure.mjs';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const markdownParser = new window.markdownit({html:false,linkify:true,breaks:false,typographer:false})
  .use(window.markdownitMark).use(window.markdownitSub).use(window.markdownitSup);
markdownParser.inline.ruler.before('escape','math_inline',(state,silent)=>{
  const source=state.src,start=state.pos;
  let open='',close='';
  if(source.startsWith('\\(',start)){open='\\(';close='\\)'}
  else if(source[start]==='$'&&source[start+1]!=='$'){open='$';close='$'}
  else return false;
  const end=source.indexOf(close,start+open.length);
  if(end<0||end===start+open.length)return false;
  const content=source.slice(start+open.length,end);
  if(!content.trim()||/^\s|\s$/.test(content))return false;
  if(!silent){const token=state.push('math_inline','span',0);token.content=content;token.markup=open}
  state.pos=end+close.length;return true;
});
markdownParser.renderer.rules.math_inline=(tokens,index)=>{
  const formula=tokens[index].content;
  return `<span class="math" data-tex="${esc(formula)}" contenteditable="false">${esc(formula)}</span>`;
};

export function inline(text) {
  return markdownParser.renderInline(String(text));
}

const divider = s => /^(?:[-*_]\s*){3,}$/.test(s) || /^(?:—|–|―|─|━){3,}$/.test(s);
const listMatch = s => s.match(/^\s*(?:[-+*•·●○▪▫☑✓□]\s+|\[[ xX]\]\s+)(.*)$/);
const orderedMatch = s => s.match(/^\s*(?:\d+[.)、．）]|[（(]\d+[）)]|[０-９]+[.、．）]|[①-⑳])\s*(.*)$/);
const orderedInfo = s => {
  const match = s.match(/^\s*((?:\d+(?:\.\d+){0,2}[.)、．）]?|[（(]\d+[）)]|[０-９]+[.、．）]|[①-⑳]|Q\s*\d+|题目\s*\d+|第[一二三四五六七八九十百零〇\d]+题)[：:]?\s*)(.*)$/i);
  return match ? {number:match[1].trim(),content:match[2].trim()} : null;
};
const tableCells = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));
const isTableRule = s => s.includes('|') && tableCells(s).length > 0 && tableCells(s).every(x => /^:?-{3,}:?$/.test(x));
const sectionKind = text => {
  if (/参考答案|答案解析|答案与解析|标准答案/.test(text)) return 'answers';
  if (/选择题|单选题|多选题/.test(text)) return 'choice';
  if (/判断题|正误题/.test(text)) return 'judgment';
  if (/填空题|补全题/.test(text)) return 'fill';
  if (/简答题|问答题|名词解释/.test(text)) return 'short';
  if (/代码.{0,4}题|编程题|程序设计|上机题/.test(text)) return 'code';
  if (/计算题|求解题/.test(text)) return 'calculation';
  if (/综合题|阅读理解|材料分析/.test(text)) return 'comprehensive';
  return '';
};
const choiceLine = s => {
  const match=s.match(/^\s*(?:([A-H])[.．、)]|[（(]([A-H])[）)])\s*(.*)$/);
  return match?{label:match[1]||match[2],content:match[3]}:null;
};
const isQuestionTitle = text => text.length <= 36 && !/[。！？!?；;]$/.test(text) && /试卷|小测|测验|练习|考试|习题|题库|复习|作业|报告|总结|笔记|教程/.test(text);
function choiceParts(text) {
  const matches = [...text.matchAll(/(?:^|[\s　])([A-H])[.．、)]\s*/g)];
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
const startsBlock = s => /^(?:```|~~~|\$\$|\\\[|#{1,6}\s|>\s?|[-+*•·●○▪▫☑✓□]\s+|\[[ xX]\]\s+|\d+(?:\.\d+){0,2}[.)、．）]?\s+|[０-９]+[.、．）]\s*|[（(]\d+[）)]|[①-⑳]|[【〔〖\[]\s*\d+\s*[】〕〗\]]|Q\s*\d+|题目\s*\d+|第[一二三四五六七八九十百零〇\d]+题|[一二三四五六七八九十]+[、.．])/.test(s) || divider(s);

export function parse(text) {
  const doc = emptyDocument(), lines = String(text).replace(/\r/g, '').split('\n');
  let i = 0, activeQuestionKind = '', inAnswerSection = false;
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
    if ((m = t.match(/^(#{1,6})\s+(.+?)\s*#*$/))) {
      const content=m[2], kind=sectionKind(content);
      if (!doc.blocks.length && m[1].length===1) doc.blocks.push({type:'title',content});
      else doc.blocks.push({type:'heading',level:Math.min(m[1].length,3),content,category:kind||undefined});
      activeQuestionKind=kind;if(kind==='answers')inAnswerSection=true;else if(kind&&!inAnswerSection)inAnswerSection=false;i++;continue;
    }
    if (i + 1 < lines.length && /^\s*(?:=+|-{3,})\s*$/.test(lines[i+1]) && t.length) {
      const kind=sectionKind(t);doc.blocks.push({type:'heading', level:lines[i+1].trim()[0] === '=' ? 1 : 2, content:t,category:kind||undefined}); activeQuestionKind=kind;if(kind==='answers')inAnswerSection=true;else if(kind&&!inAnswerSection)inAnswerSection=false;i += 2; continue;
    }
    if ((m=t.match(/^(?:参考答案|答案解析|标准答案|选择题|单选题|多选题|判断题|正误题|填空题|简答题|问答题|代码题|编程题|计算题|综合题)(?:\s*（[^）]*）)?[：:]?$/))) {
      const kind=sectionKind(t);doc.blocks.push({type:'heading',level:1,content:t,category:kind||undefined});activeQuestionKind=kind;if(kind==='answers')inAnswerSection=true;else if(kind&&!inAnswerSection)inAnswerSection=false;i++;continue;
    }
    const nextNonEmpty=lines.slice(i+1).find(line=>line.trim())||'';
    const questionContext=Boolean(activeQuestionKind||choiceLine(nextNonEmpty)||choiceParts(orderedInfo(t)?.content||''));
    const detectedHeading=detectHeading(t,{previousLine:lines[i-1]||'',nextLine:lines[i+1]||'',blankBefore:i===0||!lines[i-1]?.trim(),blankAfter:i===lines.length-1||!lines[i+1]?.trim(),previousIsHeading:['title','heading'].includes(doc.blocks.at(-1)?.type),questionSection:questionContext});
    if(detectedHeading){const kind=sectionKind(t);doc.blocks.push({type:'heading',level:detectedHeading.level,content:t,category:kind||undefined});activeQuestionKind=kind;if(kind==='answers')inAnswerSection=true;else if(kind&&!inAnswerSection)inAnswerSection=false;i++;continue;}
    if(t.length<=32&&/[：:]$/.test(t)&&!/^\s*(?:答案|正确答案|答案解析|参考答案|标准答案)[：:]?$/.test(t)) { doc.blocks.push({type:'heading',level:2,content:t}); i++; continue; }
    if (!doc.blocks.length && isQuestionTitle(t)) { doc.blocks.push({type:'title',content:t}); i++; continue; }
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
    const numbered=orderedInfo(t);
    if (numbered && (activeQuestionKind || isNumberedQuestion(t) || choiceParts(numbered.content) || (()=>{let j=i+1;while(j<lines.length&&!lines[j].trim())j++;return j<lines.length&&choiceLine(lines[j]);})())) {
      const kind=activeQuestionKind||'choice', choices=choiceParts(numbered.content);
      if(inAnswerSection||kind==='answers') doc.blocks.push({type:'answerItem',number:numbered.number,content:numbered.content});
      else doc.blocks.push({type:'question',number:numbered.number,content:choices?choices.prefix:numbered.content,kind});
      if(choices?.items.length) doc.blocks.push({type:'choiceList',items:choices.items,kind});
      i++;continue;
    }
    if (choiceLine(t)) {
      const items=[], firstLabel=choiceLine(t).label.charCodeAt(0);let expected=firstLabel,j=i;
      while(j<lines.length){
        if(!lines[j].trim()){j++;continue;}
        const option=choiceLine(lines[j]);
        if(!option||option.label.charCodeAt(0)!==expected)break;
        items.push(option.content.trim());expected++;j++;
      }
      if(items.length>=2){doc.blocks.push({type:'choiceList',items,kind:activeQuestionKind||'choice'});i=j;continue;}
    }
    if (orderedMatch(t)) {
      const items=[],numbers=[];let j=i;
      while(j<lines.length){
        if(!lines[j].trim()){let next=j;while(next<lines.length&&!lines[next].trim())next++;if(next>=lines.length||!orderedMatch(lines[next].trim()))break;j=next}
        const item=orderedInfo(lines[j].trim());if(!item)break;
        items.push(item.content);numbers.push(item.number);j++;
      }
      doc.blocks.push({type:'orderedList',items,numbers});i=j;continue;
    }
    if (/^\s{4,}\S/.test(raw)) { const code=[]; while(i<lines.length && (/^\s{4,}\S/.test(lines[i]) || !lines[i].trim())) code.push(lines[i++].replace(/^ {4}/,'')); doc.blocks.push({type:'codeBlock',language:'',content:code.join('\n').trimEnd()}); continue; }
    const paragraph=[t]; i++;
    while(i<lines.length && lines[i].trim() && !startsBlock(lines[i].trim()) && !(i+1<lines.length && /^(?:=+|-{3,})$/.test(lines[i+1].trim()))) paragraph.push(lines[i++].trim());
    const content = paragraph.join('\n'), choices = choiceParts(content);
    if (choices) {
      if (choices.prefix) doc.blocks.push({type:'paragraph',content:choices.prefix});
      doc.blocks.push({type:'choiceList',items:choices.items,kind:activeQuestionKind||'choice'});
    } else if(doc.blocks.length===1&&doc.blocks[0].type==='title') doc.blocks.push({type:'intro',content});
    else if(/^(?:参考答案|答案|正确答案|答案解析|解析|解答)[：:]/.test(content)) doc.blocks.push({type:'answerNote',content});
    else doc.blocks.push({type:'paragraph',content});
  }
  return doc;
}

export function toMarkdown(doc) {
  return doc.blocks.map(b=>{
    if(b.type==='title') return '# '+b.content;
    if(b.type==='heading') return '#'.repeat(b.level)+' '+b.content;
    if(b.type==='intro') return b.content;
    if(b.type==='question') return `${b.number} ${b.content}`.trimEnd();
    if(b.type==='answerItem') return `${b.number} ${b.content}`.trimEnd();
    if(b.type==='answerNote') return b.content;
    if(b.type==='paragraph') return b.content;
    if(b.type==='bulletList') return b.items.map(x=>'- '+x).join('\n');
    if(b.type==='orderedList') return b.items.map((x,i)=>`${b.numbers?.[i]||`${i+1}.`} ${x}`).join('\n');
    if(b.type==='choiceList') return b.items.map((x,i)=>`${String.fromCharCode(65+i)}. ${x}`).join('\n');
    if(b.type==='blockquote') return b.content.split('\n').map(x=>'> '+x).join('\n');
    if(b.type==='codeBlock') return '```'+(b.language||'')+'\n'+b.content+'\n```';
    if(b.type==='mathBlock') return '$$\n'+b.content+'\n$$';
    if(b.type==='divider') return '---';
    if(b.type==='table') return '| '+b.header.join(' | ')+' |\n| '+b.header.map(()=>'---').join(' | ')+' |\n'+b.rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
    return '';
  }).join('\n\n')+'\n';
}

export function blockHtml(b, settings={}) {
  if(b.type==='title') return `<h1 class="document-title">${inline(b.content)}</h1>`;
  if(b.type==='intro') return `<p class="document-intro">${inline(b.content).replace(/\n/g,'<br>')}</p>`;
  if(b.type==='heading') return `<h${b.level}${b.category?` class="section-heading section-${esc(b.category)}"`:''}>${inline(b.content)}</h${b.level}>`;
  if(b.type==='question') return `<p class="question question-${esc(b.kind||'generic')}"><span class="question-number">${inline(b.number)}</span> ${inline(b.content)}</p>`;
  if(b.type==='answerItem') return `<p class="answer-item"><span class="answer-number">${inline(b.number)}</span> ${inline(b.content)}</p>`;
  if(b.type==='answerNote') return `<p class="answer-note">${inline(b.content)}</p>`;
  if(b.type==='paragraph') return `<p>${inline(b.content).replace(/\n/g,'<br>')}</p>`;
  if(b.type==='bulletList') return '<ul class="explicit-list">'+b.items.map(x=>`<li><span class="list-marker bullet-marker" contenteditable="false">•</span><span class="list-content">${inline(x)}</span></li>`).join('')+'</ul>';
  if(b.type==='orderedList') return '<ol class="explicit-list">'+b.items.map((x,index)=>`<li><span class="list-marker" contenteditable="false">${esc(formatListNumber(index,settings.list?.numbering,b.numbers?.[index]))}</span><span class="list-content">${inline(x)}</span></li>`).join('')+'</ol>';
  if(b.type==='choiceList') return `<ol class="choice-list explicit-list choice-${esc(b.kind||'choice')}">`+b.items.map((x,index)=>`<li><span class="list-marker" contenteditable="false">${String.fromCharCode(65+index)}.</span><span class="list-content">${inline(x)}</span></li>`).join('')+'</ol>';
  if(b.type==='blockquote') return `<blockquote>${inline(b.content).replace(/\n/g,'<br>')}</blockquote>`;
  if(b.type==='codeBlock') return `<pre data-language="${esc(b.language||'')}"><code>${esc(b.content)}</code></pre>`;
  if(b.type==='mathBlock') return `<div class="math-block" data-tex="${esc(b.content)}" contenteditable="false">${esc(b.content)}</div>`;
  if(b.type==='divider') return '<hr>';
  if(b.type==='table') return '<table><thead><tr>'+b.header.map(x=>`<th>${inline(x)}</th>`).join('')+'</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+b.header.map((_,i)=>`<td>${inline(r[i]||'')}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  return '';
}
