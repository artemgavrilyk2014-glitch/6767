const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // HTTP запит через main process (обходить CORS)
  request: (opts) => ipcRenderer.invoke('api-request', opts),
  // Керування вікном
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),
});
