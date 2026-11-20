const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('WordTapAPI', {
  getPathForFile: (file) => {
    try {
      if (webUtils && webUtils.getPathForFile) {
        return webUtils.getPathForFile(file);
      }
    } catch {}
    return file.path || '';
  },
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
  },
  // Audio Fix & Transcoding APIs
  probeAudio: (filePath) => ipcRenderer.invoke('audio:probe', filePath),
  transcodeAudio: (filePath) => ipcRenderer.invoke('audio:transcode', filePath),
  getAudioStreamUrl: (params) => ipcRenderer.invoke('audio:get-stream-url', params),
  // VLsub OpenSubtitles APIs
  calculateVLSubHash: (filePath) => ipcRenderer.invoke('vlsub:calculate-hash', filePath),
  searchVLSub: (params) => ipcRenderer.invoke('vlsub:search', params),
  downloadVLSub: (subId) => ipcRenderer.invoke('vlsub:download', subId)
});
