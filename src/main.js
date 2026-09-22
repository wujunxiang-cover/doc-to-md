import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import { fileURLToPath } from 'node:url';
import { htmlToMarkdown, textToMarkdown } from './converter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#f7f7f8',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  window.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('convert-file', async (_event, { name, data }) => {
    const extension = path.extname(name).toLowerCase();
    const buffer = Buffer.from(data);
    if (extension === '.docx') {
      const { value, messages } = await mammoth.convertToHtml({ buffer });
      return { markdown: htmlToMarkdown(value), warnings: messages.map((m) => m.message) };
    }
    if (extension === '.txt' || extension === '.md' || extension === '.markdown') {
      return { markdown: textToMarkdown(buffer.toString('utf8')), warnings: [] };
    }
    throw new Error('仅支持 DOCX、TXT 和 Markdown 文件。');
  });

  ipcMain.handle('save-markdown', async (_event, { suggestedName, content }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 Markdown',
      defaultPath: suggestedName.replace(/\.[^.]+$/, '') + '.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (!canceled && filePath) await fs.writeFile(filePath, content, 'utf8');
    return { canceled, filePath };
  });

  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
