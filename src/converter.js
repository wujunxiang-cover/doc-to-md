import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

turndown.addRule('strikethrough', {
  filter: ['del', 's', 'strike'],
  replacement: (content) => `~~${content}~~`
});

export function normalizeMarkdown(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/^(\s*)-\s{2,}/gm, '$1- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

export function htmlToMarkdown(html) {
  return normalizeMarkdown(turndown.turndown(html));
}

export function textToMarkdown(text) {
  return normalizeMarkdown(text);
}
