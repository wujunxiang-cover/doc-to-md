const sentenceEnd = /[。！？!?；;]$/;
function normalizeMarker(text) {
  let normalized=String(text).replace(/[\u200b-\u200f\ufeff]/g, '').trim();
  const boxed=normalized.match(/^[【〔〖\[]\s*([0-9０-９]+)\s*[】〕〗\]]\s*(.*)$/);
  if(boxed)normalized=`${boxed[1]}. ${boxed[2]}`;
  const dingbat=normalized.match(/^([❶-❿])\s*(.*)$/);
  if(dingbat)normalized=`（${'❶❷❸❹❺❻❼❽❾❿'.indexOf(dingbat[1])+1}）${dingbat[2]}`;
  return normalized.replace(/^[\s>*#·•●○▪▫☑✓□▢■□◆◇]+/, '').trim();
}

function isQuestionMarker(text) {
  return /^(?:Q\s*\d+|题目\s*\d+|第\s*[一二三四五六七八九十百零〇0-9]+\s*题)(?:[.、．:：)）\s]|$)/i.test(text);
}

function hasSiblingNumber(text) {
  const candidate = normalizeMarker(text);
  return /^(?:\d{1,3}[.)、．）]|[（(]\d+[）)]|[①-⑳]|[一二三四五六七八九十]+[、.．])\s*\S/.test(candidate);
}

/** Score a standalone line as a document heading; null means keep it as body/list text. */
export function detectHeading(input, context = {}) {
  const text = normalizeMarker(input);
  if (!text || text.length > 100 || isQuestionMarker(text)) return null;
  if (/^#{1,6}\s+/.test(text)) return { level: Math.min(text.match(/^#+/)[0].length, 3), score: 100 };
  if (context.questionSection && /^(?:\d|[（(]\d|[①-⑳]|Q\s*\d|题目\s*\d|第[一二三四五六七八九十百零〇0-9]+题)/i.test(text)) return null;

  const chapter = text.match(/^(?:第[一二三四五六七八九十百零〇0-9]+[章节篇部]|第[一二三四五六七八九十百零〇0-9]+部分|Chapter\s+\d+)\s*(.*)$/i);
  if (chapter) return { level: /节/.test(text) ? 2 : 1, score: 100 };
  if (/^[一二三四五六七八九十]+[、.．]\s*\S/.test(text)) return { level: 1, score: 92 };

  const decimal = text.match(/^([0-9０-９]+(?:\.[0-9０-９]+){1,2})[.、．)]?\s+(.+)$/);
  if (decimal) {
    if (sentenceEnd.test(text) || decimal[2].length > 76) return null;
    return { level: Math.min(decimal[1].split('.').length, 3), score: 88 };
  }
  const chineseSub = text.match(/^[（(]([一二三四五六七八九十]+)[）)]\s*(.+)$/);
  if (chineseSub) return sentenceEnd.test(text) ? null : { level: 2, score: 84 };
  const arabicSub = text.match(/^[（(]([0-9０-９]+)[）)]\s*(.+)$/);
  if (arabicSub) {
    if (sentenceEnd.test(text) || arabicSub[2].length > 70) return null;
    return { level: 3, score: 80 };
  }
  if (/^[①-⑳]\s*\S/.test(text) && !sentenceEnd.test(text)) return { level: 3, score: 76 };

  const simple = text.match(/^([0-9０-９]+)[.、．)）]\s*(.+)$/);
  if (!simple || context.questionSection || sentenceEnd.test(text) || simple[2].length > 64) return null;
  // Numbered runs are more likely lists than headings. Require an isolated, compact label.
  if (hasSiblingNumber(context.previousLine || '') || hasSiblingNumber(context.nextLine || '')) return null;
  const body = simple[2];
  let score = 52;
  if (body.length <= 28) score += 14;
  if (/[：:]$/.test(body)) score += 10;
  if (/[A-Za-z][A-Za-z0-9_+#.-]*/.test(body)) score += 8;
  if (context.previousIsHeading) score += 8;
  if (context.blankBefore) score += 5;
  if (context.blankAfter) score += 4;
  if (/[，,]/.test(body)) score -= 12;
  if (body.length > 45) score -= 10;
  if (score < 66) return null;
  return { level: 2, score };
}

export function isNumberedQuestion(input) {
  return /^(?:Q\s*\d+|题目\s*\d+|第\s*[一二三四五六七八九十百零〇0-9]+\s*题)(?:[.、．:：)）\s]|$)/i.test(normalizeMarker(input));
}
