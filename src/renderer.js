const dropZone = document.querySelector('#drop-zone');
const input = document.querySelector('#file-input');
const workspace = document.querySelector('#workspace');
const markdown = document.querySelector('#markdown');
const status = document.querySelector('#status');
const warning = document.querySelector('#warning');
const fileName = document.querySelector('#file-name');
let selectedFile;

async function processFile(file) {
  if (!file) return;
  const allowed = ['docx', 'txt', 'md', 'markdown'];
  if (!allowed.includes(file.name.split('.').pop().toLowerCase())) {
    status.textContent = '请选择 DOCX、TXT 或 Markdown 文件。';
    return;
  }
  status.textContent = '正在转换…';
  try {
    const data = await file.arrayBuffer();
    const result = await window.docToMd.convert({ name: file.name, data });
    selectedFile = file;
    fileName.textContent = file.name;
    markdown.value = result.markdown;
    warning.hidden = result.warnings.length === 0;
    warning.textContent = result.warnings.length ? `提示：${result.warnings.join('；')}` : '';
    dropZone.hidden = true;
    workspace.hidden = false;
    status.textContent = '转换完成，可直接编辑后导出。';
  } catch (error) {
    status.textContent = `转换失败：${error.message}`;
  }
}

document.querySelector('#choose-file').addEventListener('click', () => input.click());
document.querySelector('#write-text').addEventListener('click', () => {
  selectedFile = new File([], 'untitled.txt', { type: 'text/plain' });
  fileName.textContent = '未命名文本';
  markdown.value = '';
  warning.hidden = true;
  dropZone.hidden = true;
  workspace.hidden = false;
  status.textContent = '输入内容后即可导出 Markdown。';
  markdown.focus();
});
input.addEventListener('change', () => processFile(input.files[0]));
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); processFile(event.dataTransfer.files[0]); });
document.querySelector('#new-file').addEventListener('click', () => { workspace.hidden = true; dropZone.hidden = false; input.value = ''; status.textContent = ''; });
document.querySelector('#export').addEventListener('click', async () => {
  if (!selectedFile) return;
  const result = await window.docToMd.save({ suggestedName: selectedFile.name, content: markdown.value });
  status.textContent = result.canceled ? '已取消导出。' : `已导出：${result.filePath}`;
});
