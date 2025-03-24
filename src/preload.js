// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window management
  adjustWindowHeight: (hasError) => ipcRenderer.send('adjust-window-height', hasError),
  showErrorDialog: (title, message) => ipcRenderer.send('show-error-dialog', { title, message }),

  // Recording functions
  loadObjectionRecord: (args) => ipcRenderer.send('load-objection-record', args),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  stopRecording: () => ipcRenderer.send('stop-recording'),
  checkAudioDevice: () => ipcRenderer.invoke('check-audio-device'),

  // Event listeners
  onRecordingStarted: (callback) => ipcRenderer.on('recording-started', () => callback()),
  onRecordingFinished: (callback) => ipcRenderer.on('recording-finished', () => callback()),
  onRecordingFailed: (callback) => ipcRenderer.on('recording-failed', (_, message) => callback(message)),
  onRecordingCancelled: (callback) => ipcRenderer.on('recording-cancelled', () => callback()),
  onConversionProgress: (callback) => ipcRenderer.on('conversion-progress', (_, progress) => callback(progress)),

  // Settings functions
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
});
