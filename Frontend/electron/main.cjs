const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');







// Determinar si estamos en desarrollo o producción
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// ─── Ventana principal ────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    icon: path.join(__dirname, '../public/icon.png'),
    title: 'HEG Formatos',
    show: false
  });

  if (isDev) {
    console.log('Modo desarrollo: cargando desde http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    console.log('Modo producción: cargando desde', indexPath);
    console.log('Archivo existe:', fs.existsSync(indexPath));
    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Error al cargar:', errorCode, errorDescription);
    mainWindow.webContents.openDevTools();
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload()
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Rehacer', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Seleccionar todo', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Pantalla completa',
          accelerator: 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
        {
          label: 'Herramientas de desarrollo',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow.webContents.toggleDevTools()
        },
        { type: 'separator' },
        { label: 'Acercar', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Alejar', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Tamaño original', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── Auto-updater ─────────────────────────────────────────────────────────────

function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes || ''
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', { message: err.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update-download-progress', {
      percent: Math.round(progress.percent)
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', { version: info.version });
  });

  ipcMain.on('check-for-update',  () => autoUpdater.checkForUpdates());
  ipcMain.on('download-update',   () => autoUpdater.downloadUpdate());
  ipcMain.on('install-update',    () => autoUpdater.quitAndInstall(false, true));

  setTimeout(() => autoUpdater.checkForUpdates(), 3000);
}

// ─── Ciclo de vida de la app ──────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});
