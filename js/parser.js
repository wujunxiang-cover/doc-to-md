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
const stepInfo = s => {
  const match=s.match(/^\s*((?:第\s*[一二三四五六七八九十百零〇0-9]+\s*步|步骤\s*[一二三四五六七八九十百零〇0-9]+)[：:、.．）)]?)\s*(.*)$/i);
  return match?{number:match[1].trim(),content:match[2].trim()}:null;
};
const orderedMatch = s => s.match(/^\s*(?:\d+[.)、．）]|[（(]\d+[）)]|[０-９]+[.、．）]|[①-⑳]|第\s*[一二三四五六七八九十百零〇0-9]+\s*步|步骤\s*[一二三四五六七八九十百零〇0-9]+)\s*(.*)$/i);
const orderedInfo = s => {
  const step=stepInfo(s);if(step)return step;
  const match = s.match(/^\s*((?:\d+(?:\.\d+){0,2}[.)、．）]?|[（(]\d+[）)]|[０-９]+[.、．）]|[①-⑳]|Q\s*\d+|题目\s*\d+|第[一二三四五六七八九十百零〇\d]+题)[：:]?\s*)(.*)$/i);
  return match ? {number:match[1].trim(),content:match[2].trim()} : null;
};
const tableCells = s => s.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));
const pipeRow = s => /^\s*\|.*\|\s*$/.test(s);
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
const sectionLabel = text => /^(?:(?:javascript|typescript|python|java|c\+\+|html|sql)\s+)?(?:代码示例|示例代码|使用示例|示例|操作步骤|实现步骤|安装步骤|(?:[\u4e00-\u9fff]{0,12})流程(?:说明|图)?|注意事项|主要功能|功能特点|功能|内容|特性|使用场景|适用范围|总结|结论|结果|环境准备|准备工作)$/i.test(text.trim());
const codeLineScore = (raw, inCodeSection=false) => {
  const text=raw.trim();if(!text)return 0;
  if(/^\s{4,}\S/.test(raw))return 3;
  if(/^(?:\/\/|\/\*|\*\/|#include\b|import\b|from\b.+\bimport\b|export\b|(?:async\s+)?function\b|class\b|interface\b|type\b|const\b|let\b|var\b|return\b|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|try\b|catch\s*\(|def\b|print\s*\(|console\.|SELECT\b|INSERT\b|UPDATE\b|CREATE\b|<\/?[A-Za-z][^>]*>)/i.test(text))return 3;
  if(/^[A-Za-z_$][\w$.[\]"'`]*\s*(?:=|\+=|-=|:=)\s*\S/.test(text))return /[;{}]/.test(text)?3:2;
  if(/\b[A-Za-z_$][\w$]*\s*\([^。！？\n]*\)\s*;?$/.test(text))return 3;
  if(/(?:=>|===|!==|==|!=|->|[{};])/.test(text))return 2;
  return inCodeSection&&/[A-Za-z0-9_$()[\]{}=]/.test(text)?1:0;
};
const markInlineCode = text => text
  .replace(/(?<![`\w.])([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\([^()\n]*\))(?![`\w])/g,'`$1`')
  .replace(/(?<![`A-Za-z0-9_])([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)(?![`A-Za-z0-9_])/g,'`$1`');
function normalizeSource(text){
  const result=[];let fence='',blank=false;
  for(const raw of String(text).replace(/\r/g,'').split('\n')){
    const trimmed=raw.trim();
    if(!fence&&/^(?:```|~~~)/.test(trimmed)){fence=trimmed.slice(0,3);result.push(trimmed);blank=false;continue}
    if(fence){result.push(raw);if(trimmed.startsWith(fence))fence='';blank=false;continue}
    if(!trimmed){if(!blank)result.push('');blank=true;continue}
    blank=false;
    if(/^\t+\S/.test(raw)){result.push(`    ${raw.replace(/^\t+/, '').replace(/\s+$/,'')}`);continue}
    if(/^ {4,}\S/.test(raw)){result.push(raw.replace(/\s+$/,'').replace(/\u00a0/g,' '));continue}
    if(raw.includes('\t')){const cells=raw.trim().split(/\t+/).map(cell=>cell.trim());if(cells.length>=2){result.push(`| ${cells.join(' | ')} |`);continue}}
    const indent=(raw.match(/^ {0,3}/)||[''])[0];
    const inlineCode=[];
    let line=raw.slice(indent.length).replace(/(`+)[^`]*?\1/g,match=>{const index=inlineCode.push(match)-1;return `\uE000${index}\uE001`;}).replace(/[\u00a0\u2007\u202f\t\u3000]+/g,' ')
      .replace(/([\u3400-\u9fff])[ ]+(?=[\u3400-\u9fff])/g,'$1')
      .replace(/ +([，。！？；：、）》】」』])/g,'$1')
      .replace(/([，。！？；：、]) +/g,'$1')
      .replace(/([（【《「『]) +/g,'$1')
      .replace(/ {2,}/g,' ').trimEnd();
    line=line.replace(/\uE000(\d+)\uE001/g,(_,index)=>inlineCode[Number(index)]);
    if(codeLineScore(raw)<2)line=markInlineCode(line);
    result.push(indent+line);
  }
  return result.join('\n').trim();
}
const joinSoftLines = lines => lines.reduce((joined,line)=>{
  if(!joined)return line;
  return joined+(/[A-Za-z0-9]$/.test(joined)&&/^[A-Za-z0-9]/.test(line)?' ':'')+line;
},'');
function flowSteps(text){
  const parts=text.split(/\s*(?:→|➜|⇒|⟶|->|-->)\s*/).map(step=>step.trim()).filter(Boolean);
  return parts.length>=3&&parts.every(part=>part.length<=70)?parts:null;
}
const codeLanguage = (text, context='') => {
  const source=`${context}\n${text}`;
  if(/#include|int\s+main\s*\(|std::|cv::/.test(source))return 'cpp';
  if(/\b(?:import\s+cv2|from\s+cv2|cv2\.)/.test(source))return 'python';
  if(/\b(def|elif|print)\b|:\s*$/.test(source)&&/^\s{4,}/m.test(source))return 'python';
  if(/<\/?(?:html|body|div|span|p|section|table)\b/i.test(source))return 'html';
  if(/\b(SELECT|INSERT|UPDATE|CREATE\s+TABLE)\b/i.test(source))return 'sql';
  if(/\b(const|let|var|function|console\.|=>|import\s+\{)/.test(source))return 'javascript';
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
const startsBlock = s => /^(?:```|~~~|\$\$|\\\[|#{1,6}\s|>\s?|[-+*•·●○▪▫☑✓□]\s+|\[[ xX]\]\s+|\d+(?:\.\d+){0,2}[.)、．）]?\s+|[０-９]+[.、．）]\s*|[（(]\d+[）)]|[①-⑳]|[【〔〖\[]\s*\d+\s*[】〕〗\]]|Q\s*\d+|题目\s*\d+|第[一二三四五六七八九十百零〇\d]+题|第\s*[一二三四五六七八九十百零〇\d]+\s*步|步骤\s*[一二三四五六七八九十百零〇\d]+|[一二三四五六七八九十]+[、.．])/.test(s) || divider(s);

export function parse(text) {
  const doc = emptyDocument(), lines = normalizeSource(text).split('\n');
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
    if(sectionLabel(t)) {doc.blocks.push({type:'heading',level:doc.blocks.some(block=>block.type==='title')?2:1,content:t});activeQuestionKind='';i++;continue;}
    const previous=doc.blocks.at(-1),inCodeSection=previous?.type==='heading'&&/(?:代码|示例|code)/i.test(previous.content);
    const firstCodeScore=codeLineScore(raw,inCodeSection);
    if(firstCodeScore>=2||(inCodeSection&&firstCodeScore>0)){
      const code=[];let j=i,scoreCount=0;
      while(j<lines.length){
        const line=lines[j],lineScore=codeLineScore(line,inCodeSection);
        if(line.trim()&&lineScore===0)break;
        if(line.trim())scoreCount++;
        code.push(line.replace(/^ {4}/,''));j++;
      }
      if(scoreCount>=2||firstCodeScore>=3||inCodeSection){
        const content=code.join('\n').trimEnd();
        doc.blocks.push({type:'codeBlock',language:codeLanguage(content,inCodeSection?previous.content:''),content});i=j;continue;
      }
    }
    const flow=flowSteps(t);
    if(flow){doc.blocks.push({type:'flowDiagram',steps:flow});i++;continue;}
    const nextNonEmpty=lines.slice(i+1).find(line=>line.trim())||'';
    const questionContext=Boolean(activeQuestionKind||choiceLine(nextNonEmpty)||choiceParts(orderedInfo(t)?.content||''));
    // Question numbering must be interpreted before generic heading heuristics.
    // Otherwise stems ending with a colon ("1. 主要内容是：") get promoted to
    // headings, and numbered questions without answer choices become plain prose.
    const numbered=orderedInfo(t);
    if (numbered && (activeQuestionKind || isNumberedQuestion(t) || choiceParts(numbered.content) || (()=>{let j=i+1;while(j<lines.length&&!lines[j].trim())j++;return j<lines.length&&choiceLine(lines[j]);})())) {
      const kind=activeQuestionKind||'choice', choices=choiceParts(numbered.content);
      if(inAnswerSection||kind==='answers') doc.blocks.push({type:'answerItem',number:numbered.number,content:numbered.content});
      else doc.blocks.push({type:'question',number:numbered.number,content:choices?choices.prefix:numbered.content,kind});
      if(choices?.items.length) doc.blocks.push({type:'choiceList',items:choices.items,kind});
      i++;continue;
    }
    const nextStructured=listMatch(nextNonEmpty)||orderedMatch(nextNonEmpty)||flowSteps(nextNonEmpty)||codeLineScore(nextNonEmpty)>=2;
    if(!questionContext&&!numbered&&!sectionKind(t)&&!listMatch(t)&&!orderedMatch(t)&&!choiceLine(t)&&!/^#{1,6}\s/.test(t)&&nextStructured&&t.length<=32&&!/[。！？!?；;：:]$/.test(t)){
      doc.blocks.push({type:'heading',level:doc.blocks.some(block=>block.type==='title')?2:1,content:t});i++;continue;
    }
    const detectedHeading=detectHeading(t,{previousLine:lines[i-1]||'',nextLine:lines[i+1]||'',blankBefore:i===0||!lines[i-1]?.trim(),blankAfter:i===lines.length-1||!lines[i+1]?.trim(),previousIsHeading:['title','heading'].includes(doc.blocks.at(-1)?.type),questionSection:questionContext});
    if(detectedHeading){const kind=sectionKind(t);const level=kind&&doc.blocks.some(block=>block.type==='title')?Math.max(2,detectedHeading.level):detectedHeading.level;doc.blocks.push({type:'heading',level,content:t,category:kind||undefined});activeQuestionKind=kind;if(kind==='answers')inAnswerSection=true;else if(kind&&!inAnswerSection)inAnswerSection=false;i++;continue;}
    if(t.length<=32&&/[：:]$/.test(t)&&!numbered&&!questionContext&&!/^\s*(?:答案|正确答案|答案解析|参考答案|标准答案)[：:]?$/.test(t)) { doc.blocks.push({type:'heading',level:2,content:t}); i++; continue; }
    if (!doc.blocks.length && (isQuestionTitle(t)||(t.length<=42&&!/[。！？!?；;：:]$/.test(t)&&(!lines[i+1]?.trim()||i===lines.length-1)))) { doc.blocks.push({type:'title',content:t}); i++; continue; }
    if (divider(t)) { doc.blocks.push({type:'divider'}); i++; continue; }
    if (/^>/.test(t)) { const q=[]; while (i<lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/,'')); doc.blocks.push({type:'blockquote',content:q.join('\n')}); continue; }
    if (i+1<lines.length && t.includes('|') && isTableRule(lines[i+1])) {
      const header=tableCells(t); i+=2; const rows=[];
      while(i<lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(tableCells(lines[i++]));
      doc.blocks.push({type:'table',header,rows}); continue;
    }
    if(pipeRow(t)&&pipeRow(lines[i+1]||'')){
      const rows=[];let j=i;while(j<lines.length&&pipeRow(lines[j]))rows.push(tableCells(lines[j++]));
      const columns=rows[0]?.length||0;
      if(rows.length>=2&&columns>=2&&rows.every(row=>row.length===columns)){doc.blocks.push({type:'table',header:rows[0],rows:rows.slice(1)});i=j;continue;}
    }
    if (listMatch(t)) {
      const items=[]; while(i<lines.length && listMatch(lines[i].trim())) items.push(listMatch(lines[i++].trim())[1]);
      doc.blocks.push({type:'bulletList',items}); continue;
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
    const content = joinSoftLines(paragraph), choices = choiceParts(content);
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
    if(b.type==='flowDiagram') return b.steps.join(' → ');
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
  if(b.type==='flowDiagram') return `<div class="flow-diagram" aria-label="流程图">${b.steps.map((step,index)=>`${index?'<span class="flow-arrow" aria-hidden="true">→</span>':''}<span class="flow-step">${inline(step)}</span>`).join('')}</div>`;
  if(b.type==='divider') return '<hr>';
  if(b.type==='table') return '<table><thead><tr>'+b.header.map(x=>`<th>${inline(x)}</th>`).join('')+'</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+b.header.map((_,i)=>`<td>${inline(r[i]||'')}</td>`).join('')+'</tr>').join('')+'</tbody></table>';
  return '';
}
