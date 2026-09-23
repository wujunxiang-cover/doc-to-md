import { emptyDocument } from './model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => /^(https?:|mailto:|\/|#)/i.test(value.trim()) ? value.trim() : '#';

export function inline(text) {
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

export function parse(text) {
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

export function toMarkdown(doc) {
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

export function blockHtml(b) {
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
