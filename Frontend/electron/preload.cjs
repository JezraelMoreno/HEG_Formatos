const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  // Información de la plataforma
  platform: process.platform,

  // Verificar si estamos en Electron
  isElectron: true,

  // Métodos de IPC seguros (agregar según sea necesario)
  send: (channel, data) => {
    // Lista blanca de canales permitidos
    const validChannels = ['toMain', 'minimize', 'maximize', 'close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    const validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Auto-updater
  updater: {
    checkForUpdate:       () => ipcRenderer.send('check-for-update'),
    downloadUpdate:       () => ipcRenderer.send('download-update'),
    installUpdate:        () => ipcRenderer.send('install-update'),
    onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',         (_, i) => cb(i)),
    onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available',     ()    => cb()),
    onUpdateError:        (cb) => ipcRenderer.on('update-error',             (_, e) => cb(e)),
    onDownloadProgress:   (cb) => ipcRenderer.on('update-download-progress', (_, p) => cb(p)),
    onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',        (_, i) => cb(i)),
    removeUpdateListeners: () => {
      ['update-available', 'update-not-available', 'update-error',
       'update-download-progress', 'update-downloaded']
        .forEach(ch => ipcRenderer.removeAllListeners(ch));
    }
  }
});

// Notificar que el preload se cargó correctamente
console.log('Preload script cargado correctamente');
