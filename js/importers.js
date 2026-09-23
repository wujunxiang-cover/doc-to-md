const inlineText = value => String(value || '').replace(/\s+/g, ' ').trim();

function inlineHtml(node) {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  if (tag === 'img') return node.getAttribute('alt') ? `[图片：${inlineText(node.getAttribute('alt'))}]` : '[图片]';
  if (['script', 'style', 'noscript', 'svg'].includes(tag)) return '';
  const content = [...node.childNodes].map(inlineHtml).join('');
  if (tag === 'strong' || tag === 'b') return `**${content.trim()}**`;
  if (tag === 'em' || tag === 'i') return `*${content.trim()}*`;
  if (tag === 'del' || tag === 's' || tag === 'strike') return `~~${content.trim()}~~`;
  if (tag === 'code' && node.parentElement?.tagName !== 'PRE') return `\`${content.trim()}\``;
  if (tag === 'sup') return `^${content.trim()}^`;
  if (tag === 'sub') return `~${content.trim()}~`;
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    return href ? `[${content.trim()}](${href})` : content;
  }
  return content;
}

function listMarkdown(list, depth = 0) {
  const ordered = list.tagName.toLowerCase() === 'ol';
  const start = Math.max(1, Number(list.getAttribute('start')) || 1);
  const lines = [];
  [...list.children].filter(child => child.tagName?.toLowerCase() === 'li').forEach((item, index) => {
    const nested = [...item.children].filter(child => ['ul', 'ol'].includes(child.tagName?.toLowerCase()));
    const content = [...item.childNodes].filter(child => !nested.includes(child)).map(inlineHtml).join('').trim();
    const marker = ordered ? `${start + index}.` : '-';
    lines.push(`${'  '.repeat(depth)}${marker} ${content}`.trimEnd());
    nested.forEach(listNode => lines.push(listMarkdown(listNode, depth + 1)));
  });
  return lines.join('\n');
}

function tableMarkdown(table) {
  const rows = [...table.querySelectorAll('tr')].map(row => [...row.children]
    .filter(cell => ['th', 'td'].includes(cell.tagName.toLowerCase()))
    .map(cell => [...cell.childNodes].map(inlineHtml).join('').replace(/\|/g, '\\|').trim()));
  if (!rows.length || !rows[0].length) return '';
  const width = Math.max(...rows.map(row => row.length));
  const normalized = rows.map(row => Array.from({ length: width }, (_, index) => row[index] || ''));
  return `| ${normalized[0].join(' | ')} |\n| ${normalized[0].map(() => '---').join(' | ')} |${normalized.slice(1).map(row => `\n| ${row.join(' | ')} |`).join('')}`;
}

export function htmlToMarkdown(html) {
  const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
  const render = node => {
    if (node.nodeType === Node.TEXT_NODE) return inlineText(node.nodeValue);
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'svg'].includes(tag)) return '';
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${[...node.childNodes].map(inlineHtml).join('').trim()}`;
    if (tag === 'p') return [...node.childNodes].map(inlineHtml).join('').trim();
    if (tag === 'ul' || tag === 'ol') return listMarkdown(node);
    if (tag === 'pre') {
      const code = node.querySelector('code') || node;
      const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9) || '';
      return `\`\`\`${language}\n${code.textContent.replace(/\n+$/, '')}\n\`\`\``;
    }
    if (tag === 'blockquote') return [...node.childNodes].map(render).filter(Boolean).join('\n').split('\n').map(line => `> ${line}`).join('\n');
    if (tag === 'table') return tableMarkdown(node);
    if (tag === 'hr') return '---';
    return [...node.childNodes].map(render).filter(Boolean).join('\n');
  };
  return [...parsed.body.children].map(render).filter(Boolean).join('\n\n').trim();
}

function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);
  const encodings = bytes[0] === 0xff && bytes[1] === 0xfe ? ['utf-16le']
    : bytes[0] === 0xfe && bytes[1] === 0xff ? ['utf-16be'] : ['utf-8', 'gb18030'];
  for (const encoding of encodings) {
    try { return new TextDecoder(encoding, { fatal: true }).decode(buffer).replace(/^\uFEFF/, ''); }
    catch {}
  }
  throw new Error('文本编码无法识别');
}

let mammothPromise;
async function getMammoth() {
  if (window.mammoth) return window.mammoth;
  if (!mammothPromise) mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/mammoth.browser.min.js';
    script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error('Word 读取组件加载失败'));
    script.onerror = () => reject(new Error('Word 读取组件加载失败'));
    document.head.append(script);
  });
  return mammothPromise;
}

let pdfPromise;
async function getPdfJs() {
  if (!pdfPromise) pdfPromise = import('./vendor/pdfjs/pdf.min.mjs').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    return pdfjs;
  });
  return pdfPromise;
}

async function extractPdf(file) {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (pdf.numPages > 300) throw new Error('页数超过 300 页，已跳过以避免浏览器卡顿');
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const items = (await page.getTextContent()).items.filter(item => typeof item.str === 'string' && item.str.trim());
    if (!items.length) continue;
    const lines = [];
    let currentY = null, currentLine = [];
    for (const item of items) {
      const y = Math.round(item.transform?.[5] || 0);
      if (currentY !== null && Math.abs(y - currentY) > 3) {
        lines.push(currentLine.sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0)).map(value => value.str).join(' ').replace(/\s+/g, ' ').trim());
        currentLine = [];
      }
      currentY = y;
      currentLine.push(item);
      if (item.hasEOL) {
        lines.push(currentLine.sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0)).map(value => value.str).join(' ').replace(/\s+/g, ' ').trim());
        currentLine = []; currentY = null;
      }
    }
    if (currentLine.length) lines.push(currentLine.sort((a, b) => (a.transform?.[4] || 0) - (b.transform?.[4] || 0)).map(value => value.str).join(' ').replace(/\s+/g, ' ').trim());
    const text = lines.filter(Boolean).join('\n');
    if (text) pages.push(text);
  }
  if (!pages.length) throw new Error('没有提取到文字，可能是扫描版 PDF 或图片文件');
  return pages.join('\n\n');
}

export async function readImportedFile(file) {
  const name = String(file?.name || '文件'), extension = name.split('.').at(-1)?.toLowerCase() || '';
  if (file.size > 12 * 1024 * 1024) throw new Error('文件超过 12 MB，已跳过');
  if (['txt', 'md', 'markdown'].includes(extension)) return decodeText(await file.arrayBuffer());
  if (['html', 'htm'].includes(extension)) return htmlToMarkdown(decodeText(await file.arrayBuffer()));
  if (extension === 'docx') {
    const mammoth = await getMammoth();
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { includeDefaultStyleMap: true });
    const text = htmlToMarkdown(result.value);
    if (!text) throw new Error('Word 文档没有可读取的正文');
    return text;
  }
  if (extension === 'pdf') return extractPdf(file);
  if (extension === 'rtf') return convertRtf(decodeText(await file.arrayBuffer()));
  if (extension === 'doc') throw new Error('旧版 .doc 格式暂不支持，请另存为 .docx');
  throw new Error('不支持此文件格式');
}

function convertRtf(source) {
  let text = String(source).replace(/\\'[0-9a-f]{2}/gi, value => String.fromCharCode(parseInt(value.slice(2), 16)));
  text = text.replace(/\\u(-?\d+)\??/g, (_, raw) => String.fromCharCode((Number(raw) + 65536) % 65536));
  text = text.replace(/\\(?:par[d]?|line)\b\s?/g, '\n').replace(/\\tab\b\s?/g, '\t').replace(/\\([\\{}])/g, '$1').replace(/\\~/g, ' ');
  text = text.replace(/\\(?:fonttbl|colortbl|stylesheet|info|pict|object)\b/g, '');
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '').replace(/[{}]/g, '').replace(/\r/g, '');
  const cleaned = text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n\n').trim();
  if (!cleaned) throw new Error('RTF 文件没有可读取的正文');
  return cleaned;
}
