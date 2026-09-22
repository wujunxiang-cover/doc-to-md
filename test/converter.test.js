import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToMarkdown, textToMarkdown } from '../src/converter.js';

test('converts common Word HTML semantics to Markdown', () => {
  assert.equal(htmlToMarkdown('<h1>Title</h1><p>Hello <strong>world</strong>.</p><ul><li>One</li><li>Two</li></ul>'), '# Title\n\nHello **world**.\n\n- One\n- Two\n');
});

test('normalizes plain text line endings and whitespace', () => {
  assert.equal(textToMarkdown('a\r\n\r\n\r\nb  '), 'a\n\nb\n');
});
