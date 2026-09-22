# Doc to MD

一个离线、跨平台的桌面软件：直接输入文本，或导入 Word（`.docx`）、TXT 或已有 Markdown，得到可编辑的 Markdown 并导出为 `.md` 文件。

## 功能

- 拖放或选择文件导入
- 可直接输入文本并导出
- 保留常见标题、段落、粗体、列表等 Word 内容结构
- 转换结果可在导出前编辑
- 本地处理，文件不会上传
- 支持 macOS 和 Windows 打包

## 开发

```bash
npm install
npm start
```

运行测试：`npm test`

构建安装包：

```bash
npm run dist:mac
npm run dist:win
```

> 跨平台构建建议由 GitHub Actions 在对应系统上分别执行，或在各操作系统上本地构建。

## 限制

当前首版针对可编辑文档：DOCX、TXT 和 Markdown。扫描版 PDF 或复杂排版（图文绕排、批注、公式）需要专门的 OCR/布局识别流程，未在本版本中承诺无损还原。
