// Tipos para la API de Electron expuesta via preload
interface ElectronUpdaterAPI {
  checkForUpdate:       () => void;
  downloadUpdate:       () => void;
  installUpdate:        () => void;
  onUpdateAvailable:    (cb: (info: { version: string; releaseNotes: string }) => void) => void;
  onUpdateNotAvailable: (cb: () => void) => void;
  onUpdateError:        (cb: (err: { message: string }) => void) => void;
  onDownloadProgress:   (cb: (p: { percent: number }) => void) => void;
  onUpdateDownloaded:   (cb: (info: { version: string }) => void) => void;
  removeUpdateListeners: () => void;
}

interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
  updater?: ElectronUpdaterAPI;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
