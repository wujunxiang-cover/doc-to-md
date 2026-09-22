import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('docToMd', {
  convert: (file) => ipcRenderer.invoke('convert-file', file),
  save: (payload) => ipcRenderer.invoke('save-markdown', payload)
});
