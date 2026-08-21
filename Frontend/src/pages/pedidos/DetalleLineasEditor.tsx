import { useRef } from "react";
import type { DetalleUnion, TipoDetalle } from "../../types/pedidos";
import { columnasPorTipo, filaVaciaPorTipo, recalcularImporte } from "../../utils/pedidoDetalleColumns";
import "./DetalleLineasEditor.css";

type Props = {
  tipoDetalle: TipoDetalle;
  detalles: DetalleUnion[];
  onChange: (detalles: DetalleUnion[]) => void;
  disabled?: boolean;
};

type DetalleRecord = Record<string, string | number | null | undefined>;

export function DetalleLineasEditor({ tipoDetalle, detalles, onChange, disabled = false }: Props) {
  const tempIdRef = useRef(0);
  const columnas = columnasPorTipo(tipoDetalle);

  const agregarFila = () => {
    tempIdRef.current -= 1;
    onChange([...detalles, filaVaciaPorTipo(tipoDetalle, tempIdRef.current)]);
  };

  const quitarFila = (index: number) => {
    onChange(detalles.filter((_, i) => i !== index));
  };

  const actualizarFila = (index: number, key: string, rawValue: string, esNumero: boolean) => {
    const nuevas = detalles.map((fila, i) => {
      if (i !== index) return fila;
      const valorParsed = esNumero ? (rawValue === "" ? null : Number(rawValue)) : rawValue;
      const actualizada = { ...(fila as DetalleRecord), [key]: valorParsed } as unknown as DetalleUnion;
      const importe = recalcularImporte(tipoDetalle, actualizada);
      return { ...(actualizada as DetalleRecord), importe } as unknown as DetalleUnion;
    });
    onChange(nuevas);
  };

  return (
    <div className="detalle-lineas-editor">
      <table className="detalle-lineas-tabla">
        <thead>
          <tr>
            <th className="col-num">#</th>
            {columnas.map((col) => (
              <th key={col.key} style={{ textAlign: col.align }}>
                {col.label}
              </th>
            ))}
            {!disabled && <th className="col-acciones" aria-hidden="true" />}
          </tr>
        </thead>
        <tbody>
          {detalles.length === 0 ? (
            <tr>
              <td colSpan={columnas.length + 2} className="detalle-lineas-vacio">
                Sin líneas — agrega la primera.
              </td>
            </tr>
          ) : (
            detalles.map((fila, idx) => {
              const filaRecord = fila as unknown as DetalleRecord;
              return (
                <tr key={fila.id_detalle}>
                  <td className="col-num">{idx + 1}</td>
                  {columnas.map((col) => {
                    const valor = filaRecord[col.key];
                    if (col.auto) {
                      return (
                        <td key={col.key} className="celda-auto" style={{ textAlign: col.align }}>
                          {Number(valor || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      );
                    }
                    return (
                      <td key={col.key}>
                        <input
                          type={col.tipo === "number" ? "number" : "text"}
                          step={col.tipo === "number" ? "0.01" : undefined}
                          value={valor === null || valor === undefined ? "" : valor}
                          disabled={disabled}
                          onChange={(e) => actualizarFila(idx, col.key, e.target.value, col.tipo === "number")}
                          style={{ textAlign: col.align }}
                        />
                      </td>
                    );
                  })}
                  {!disabled && (
                    <td className="col-acciones">
                      <button
                        type="button"
                        className="detalle-lineas-quitar"
                        onClick={() => quitarFila(idx)}
                        aria-label="Quitar línea"
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" className="btn-secondary detalle-lineas-agregar" onClick={agregarFila}>
          + Agregar línea
        </button>
      )}
    </div>
  );
}
