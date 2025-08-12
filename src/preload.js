const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  pickIntro: () => ipcRenderer.invoke('pick-intro'),
  pickMains: () => ipcRenderer.invoke('pick-mains'),
  pickOutdir: () => ipcRenderer.invoke('pick-outdir'),
  start: (payload) => ipcRenderer.send('start', payload),
  onEvent: (cb) => ipcRenderer.on('event', (_e, data) => cb(data))
});
