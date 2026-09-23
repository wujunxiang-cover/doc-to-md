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
const {parse,toMarkdown,blockHtml}=await import('../js/parser.js');

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

test('recognizes procedure lists, code examples, and arrow workflows',()=>{
  const document=parse('操作步骤\n第一步：打开终端\n第二步：运行 npm install\nJavaScript 代码示例\nconst total = 2;\nconsole.log(total);\n数据流程\n用户输入 → 校验内容 → 生成文档 → 下载文件');
  const list=document.blocks.find(block=>block.type==='orderedList');
  const code=document.blocks.find(block=>block.type==='codeBlock');
  const flow=document.blocks.find(block=>block.type==='flowDiagram');
  assert.deepEqual(list.numbers,['第一步：','第二步：']);
  assert.deepEqual(list.items,['打开终端','运行 npm install']);
  assert.equal(code.language,'javascript');
  assert.equal(code.content,'const total = 2;\nconsole.log(total);');
  assert.deepEqual(flow.steps,['用户输入','校验内容','生成文档','下载文件']);
  assert.match(toMarkdown(document),/```javascript\nconst total = 2;/);
  assert.match(toMarkdown(document),/用户输入 → 校验内容 → 生成文档 → 下载文件/);
  assert.match(blockHtml(flow),/class="flow-diagram"/);
});

test('recognizes compact two-step flows and preserves multi-operator relations',()=>{
  const document=parse('down ↓ up\n\n当前图像 = 大尺度结构 + 细节\n\n特征层\n↓\n下采样\n↓\n下一层');
  assert.deepEqual(document.blocks[0],{type:'flowDiagram',steps:['down','up'],connectors:['↓']});
  assert.deepEqual(document.blocks[1],{type:'operatorSequence',steps:['当前图像','大尺度结构','细节'],connectors:['=','+']});
  assert.deepEqual(document.blocks[2],{type:'flowDiagram',steps:['特征层','下采样','下一层'],connectors:['↓','↓']});
  assert.match(blockHtml(document.blocks[1]),/class="flow-diagram relation-diagram"/);
  assert.match(toMarkdown(document),/当前图像 = 大尺度结构 \+ 细节/);
});

test('cleans redundant whitespace and joins accidental wrapped paragraph lines',()=>{
  const document=parse('  这是  一 段\n被复制后 断开的 文字 ，应该整理。\n\n\n下一段。  ');
  assert.equal(document.blocks[0].content,'这是一段被复制后断开的文字，应该整理。');
  assert.equal(document.blocks[1].content,'下一段。');
  assert.equal(parse('保留代码：`a  b`').blocks[0].content,'保留代码：`a  b`');
});

test('turns copied tab-separated rows into a semantic table',()=>{
  const document=parse('参数\t说明\n宽度\t100 px\n高度\t80 px');
  assert.deepEqual(document.blocks[0],{type:'table',header:['参数','说明'],rows:[['宽度','100 px'],['高度','80 px']]});
});

test('marks recognizable API calls and constants as inline code',()=>{
  const document=parse('调用 matchTemplate()，再用 minMaxLoc(result) 找最佳位置；方法为 TM_CCOEFF_NORMED。');
  assert.equal(document.blocks[0].content,'调用 `matchTemplate()`，再用 `minMaxLoc(result)` 找最佳位置；方法为 `TM_CCOEFF_NORMED`。');
});

test('starts decimal-numbered headings on a new block without requiring blank lines',()=>{
  const document=parse('计算机网络的目标。\n1.1 网络协议\n协议规定通信规则。');
  assert.deepEqual(document.blocks.filter(block=>block.type==='heading').map(block=>block.level),[2]);
  assert.equal(document.blocks.find(block=>block.type==='paragraph').content,'计算机网络的目标。');
});
