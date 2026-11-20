const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('WordTapAPI', {
  openVideoFile: () => ipcRenderer.invoke('dialog:open-video'),
  openSubtitleFile: () => ipcRenderer.invoke('dialog:open-subtitle'),
  readSubtitleFile: (filePath) => ipcRenderer.invoke('fs:read-subtitle', filePath),
  getSavedWords: () => ipcRenderer.invoke('storage:get-words'),
  saveWord: (entry) => ipcRenderer.invoke('storage:save-word', entry),
  getConfig: () => ipcRenderer.invoke('storage:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('storage:save-config', config),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  onFullscreenChange: (callback) => {
    ipcRenderer.on('window:fullscreen-change', (_event, isFullScreen) => callback(isFullScreen));
  }
});
