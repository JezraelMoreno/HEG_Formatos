import { useEffect, useRef } from "react";
import type { DetalleUnion, TipoDetalle } from "../../types/pedidos";
import {
  columnasPorTipo,
  filaVaciaPorTipo,
  recalcularCamposAuto,
  type ContextoAluminio,
} from "../../utils/pedidoDetalleColumns";
import "./DetalleLineasEditor.css";

type Props = {
  tipoDetalle: TipoDetalle;
  detalles: DetalleUnion[];
  onChange: (detalles: DetalleUnion[]) => void;
  disabled?: boolean;
  contextoAluminio?: ContextoAluminio;
};

type DetalleRecord = Record<string, string | number | null | undefined>;

export function DetalleLineasEditor({
  tipoDetalle,
  detalles,
  onChange,
  disabled = false,
  contextoAluminio,
}: Props) {
  const tempIdRef = useRef(0);
  const columnas = columnasPorTipo(tipoDetalle, contextoAluminio);

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
      const camposAuto = recalcularCamposAuto(tipoDetalle, actualizada, contextoAluminio);
      return { ...(actualizada as DetalleRecord), ...camposAuto } as unknown as DetalleUnion;
    });
    onChange(nuevas);
  };

  // ml/kg/m2 siempre se recalculan para aluminio (geometría/peso, no dependen del precio); el
  // importe además se recalcula si el precio/moneda/tipo de cambio del pedido cambia después de
  // haber llenado renglones (o al cargar un pedido ya guardado), para que ninguna celda
  // auto-calculada quede desfasada del contexto vigente.
  useEffect(() => {
    if (tipoDetalle !== "aluminio" || detalles.length === 0) return;
    const recalculadas = detalles.map((fila) => {
      const camposAuto = recalcularCamposAuto(tipoDetalle, fila, contextoAluminio);
      return { ...(fila as DetalleRecord), ...camposAuto } as unknown as DetalleUnion;
    });
    onChange(recalculadas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tipoDetalle,
    contextoAluminio?.monedaAluminio,
    contextoAluminio?.tipoCambio,
    contextoAluminio?.precioAluminioKg,
    contextoAluminio?.precioPinturaM2,
  ]);

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
