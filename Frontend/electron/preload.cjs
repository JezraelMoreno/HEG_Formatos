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
  }
});

// Notificar que el preload se cargó correctamente
console.log('Preload script cargado correctamente');
