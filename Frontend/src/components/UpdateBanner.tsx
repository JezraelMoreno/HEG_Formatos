import { useEffect, useState } from 'react';
import './UpdateBanner.css';

type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string }
  | { status: 'downloading'; percent: number }
  | { status: 'downloaded'; version: string }
  | { status: 'error'; message: string };

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  useEffect(() => {
    const api = window.electronAPI?.updater;
    if (!api) return;

    api.onUpdateAvailable((info) =>
      setState({ status: 'available', version: info.version })
    );
    api.onUpdateError((err) =>
      setState({ status: 'error', message: err.message })
    );
    api.onDownloadProgress((p) =>
      setState({ status: 'downloading', percent: p.percent })
    );
    api.onUpdateDownloaded((info) =>
      setState({ status: 'downloaded', version: info.version })
    );

    return () => { api.removeUpdateListeners(); };
  }, []);

  if (state.status === 'idle') return null;

  if (state.status === 'available') {
    return (
      <div className="update-banner update-banner--available">
        <span>
          Nueva versión disponible: <strong>{state.version}</strong>
        </span>
        <div className="update-banner__actions">
          <button
            className="update-banner__btn update-banner__btn--primary"
            onClick={() => window.electronAPI!.updater!.downloadUpdate()}
          >
            Descargar actualización
          </button>
          <button
            className="update-banner__btn update-banner__btn--dismiss"
            onClick={() => setState({ status: 'idle' })}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'downloading') {
    return (
      <div className="update-banner update-banner--downloading">
        <span>Descargando actualización… {state.percent}%</span>
        <div className="update-banner__progress-track">
          <div
            className="update-banner__progress-bar"
            style={{ width: `${state.percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.status === 'downloaded') {
    return (
      <div className="update-banner update-banner--downloaded">
        <span>
          Actualización lista: <strong>{state.version}</strong>
        </span>
        <button
          className="update-banner__btn update-banner__btn--primary"
          onClick={() => window.electronAPI!.updater!.installUpdate()}
        >
          Reiniciar e instalar
        </button>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="update-banner update-banner--error">
        <span>Error al verificar actualizaciones: {state.message}</span>
        <button
          className="update-banner__btn update-banner__btn--dismiss"
          onClick={() => setState({ status: 'idle' })}
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}
