const content = document.querySelector('#content');
const input = document.querySelector('#file-input');
const label = document.querySelector('#file-label');
const count = document.querySelector('#count');

function updateCount() { count.textContent = `${content.value.length.toLocaleString('zh-CN')} 字符`; }
function download() {
  const filename = (label.textContent || 'untitled').replace(/\.[^.]+$/, '') + '.md';
  const blob = new Blob([content.value.replace(/\r\n/g, '\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  link.click(); URL.revokeObjectURL(url);
}
content.addEventListener('input', updateCount);
document.querySelector('#import').addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files[0]; if (!file) return;
  content.value = await file.text(); label.textContent = file.name; updateCount(); content.focus();
});
document.querySelector('#download').addEventListener('click', download);
document.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') download(); });
updateCount();
