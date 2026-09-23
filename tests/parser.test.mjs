import test from 'node:test';
import assert from 'node:assert/strict';

class MarkdownStub {
  constructor() {
    this.inline={ruler:{before(){}}};
    this.renderer={rules:{}};
  }
  use(){return this}
  renderInline(text){return String(text)}
}
globalThis.window={markdownit:MarkdownStub,markdownitMark(){},markdownitSub(){},markdownitSup(){}};
const {parse}=await import('../js/parser.js');

test('parses a mixed study document into semantic heading levels',()=>{
  const document=parse('第一章 计算机网络\n\n1. 网络是什么\n\n计算机网络由多个设备组成。\n\n1.1 网络协议\n\n协议规定通信规则。\n\n1.1.1 可靠传输机制\n\n（1）滑动窗口');
  assert.deepEqual(document.blocks.filter(block=>block.type==='heading').map(block=>block.level),[1,2,2,3,3]);
  assert.equal(document.blocks.some(block=>block.type==='paragraph'&&block.content==='协议规定通信规则。'),true);
});

test('does not promote sentence-like numbers, but preserves ordered-list structure',()=>{
  const document=parse('今天完成了3个任务。\n\n1. 今天完成了三个任务。\n2. 明天继续处理剩余任务。');
  assert.equal(document.blocks[0].type,'paragraph');
  assert.equal(document.blocks[1].type,'orderedList');
});

test('tolerates boxed OCR numbers and recognizes question number labels',()=>{
  const document=parse('【1】 TCP可靠传输机制\n\n❶ 滑动窗口\n\nQ1 网络协议如何工作？');
  const headings=document.blocks.filter(block=>block.type==='heading');
  assert.equal(headings.length,2);
  assert.equal(document.blocks.some(block=>block.type==='question'&&block.number==='Q1'),true);
});

test('keeps numbered items under a question-type section as questions',()=>{
  const document=parse('选择题\n\n（1）TCP 如何建立连接？\n\n（2）协议用于什么？');
  assert.equal(document.blocks.filter(block=>block.type==='question').length,2);
  assert.equal(document.blocks.some(block=>block.type==='heading'&&block.content.startsWith('（1）')),false);
});

test('formats a plain exam as title, question-type sections, stems, and choices',()=>{
  const document=parse('OpenCV 模板匹配小测\n范围：matchTemplate() 和滑动窗口\n一、选择题\n1. 模板匹配主要解决的问题是：\nA. 灰度转换\nB. 寻找相似区域\n二、判断题\n7. 每个合法位置都会得到匹配分数。（ ）\n三、结果矩阵计算题\n12. 已知原图大小为 100 × 80。');
  const title=document.blocks.find(block=>block.type==='title');
  const sections=document.blocks.filter(block=>block.type==='heading');
  assert.equal(title.content,'OpenCV 模板匹配小测');
  assert.deepEqual(sections.map(block=>block.level),[2,2,2]);
  assert.equal(document.blocks.some(block=>block.type==='question'&&block.number==='1.'&&block.content.endsWith('是：')),true);
  assert.deepEqual(document.blocks.find(block=>block.type==='choiceList').items,['灰度转换','寻找相似区域']);
  assert.equal(document.blocks.some(block=>block.type==='question'&&block.number==='7.'&&block.kind==='judgment'),true);
  assert.equal(document.blocks.some(block=>block.type==='question'&&block.number==='12.'&&block.kind==='calculation'),true);
});

test('starts decimal-numbered headings on a new block without requiring blank lines',()=>{
  const document=parse('计算机网络的目标。\n1.1 网络协议\n协议规定通信规则。');
  assert.deepEqual(document.blocks.filter(block=>block.type==='heading').map(block=>block.level),[2]);
  assert.equal(document.blocks.find(block=>block.type==='paragraph').content,'计算机网络的目标。');
});
