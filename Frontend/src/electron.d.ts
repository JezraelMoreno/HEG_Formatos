// Tipos para la API de Electron expuesta via preload
interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
