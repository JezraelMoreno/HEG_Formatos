import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/Modal";
import { DetalleLineasEditor } from "./DetalleLineasEditor";
import { usePedidoTotales } from "../../hooks/usePedidoTotales";
import { apiFetch } from "../../api/client";
import type { AnticipoDisponible, DetalleUnion, Pedido, TipoDetalle } from "../../types/pedidos";
import type { ContextoAluminio } from "../../utils/pedidoDetalleColumns";
import "./PedidoFormModal.css";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  idProyecto: number;
  onCreated: (pedido: Pedido) => void;
};

type FormState = {
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  fecha_aprobacion: string;
  concepto: string;
  porcentaje_descuento: string;
  situaciones_especiales: string;
  descripcion_general: string;
  moneda_aluminio: "USD" | "MXN";
  tipo_cambio: string;
  precio_aluminio_kg: string;
  precio_pintura_m2: string;
};

const FORM_INICIAL: FormState = {
  pedido: "",
  clan: "",
  familia: "CR",
  proveedor: "",
  fecha_aprobacion: "",
  concepto: "",
  porcentaje_descuento: "",
  situaciones_especiales: "",
  descripcion_general: "",
  moneda_aluminio: "MXN",
  tipo_cambio: "",
  precio_aluminio_kg: "",
  precio_pintura_m2: "",
};

const FAMILIA_DEFAULT: Record<TipoDetalle, string> = {
  cristal: "CR",
  aluminio: "AL",
  miscelaneos: "",
};

export function PedidoFormModal({ isOpen, onClose, idProyecto, onCreated }: Props) {
  const [tipoDetalle, setTipoDetalle] = useState<TipoDetalle>("cristal");
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [detalles, setDetalles] = useState<DetalleUnion[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [anticiposDisponibles, setAnticiposDisponibles] = useState<AnticipoDisponible[]>([]);
  const [idAnticipoSeleccionado, setIdAnticipoSeleccionado] = useState<number | "">("");
  const [montoAplicadoAnticipo, setMontoAplicadoAnticipo] = useState("");

  const totales = usePedidoTotales(
    detalles,
    Number(form.porcentaje_descuento || 0),
    esAnticipo ? 0 : Number(montoAplicadoAnticipo || 0)
  );
  const anticipoSeleccionado = anticiposDisponibles.find((a) => a.id === idAnticipoSeleccionado);

  useEffect(() => {
    if (esAnticipo || !form.familia.trim()) {
      setAnticiposDisponibles([]);
      setIdAnticipoSeleccionado("");
      setMontoAplicadoAnticipo("");
      return;
    }
    const familia = form.familia.trim();
    const timer = setTimeout(() => {
      apiFetch<AnticipoDisponible[]>(`/proyectos/${idProyecto}/anticipos-disponibles?familia=${encodeURIComponent(familia)}`)
        .then((data) => setAnticiposDisponibles(Array.isArray(data) ? data : []))
        .catch(() => setAnticiposDisponibles([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [esAnticipo, form.familia, idProyecto]);

  const contextoAluminio: ContextoAluminio = useMemo(
    () => ({
      monedaAluminio: form.moneda_aluminio,
      tipoCambio: Number(form.tipo_cambio || 1),
      precioAluminioKg: form.precio_aluminio_kg.trim() === "" ? null : Number(form.precio_aluminio_kg),
      precioPinturaM2: form.precio_pintura_m2.trim() === "" ? null : Number(form.precio_pintura_m2),
    }),
    [form.moneda_aluminio, form.tipo_cambio, form.precio_aluminio_kg, form.precio_pintura_m2]
  );

  const cambiarTipoDetalle = (tipo: TipoDetalle) => {
    setTipoDetalle(tipo);
    setDetalles([]);
    setForm((prev) => ({ ...prev, familia: FAMILIA_DEFAULT[tipo] }));
  };

  const cerrar = () => {
    if (guardando) return;
    setForm(FORM_INICIAL);
    setDetalles([]);
    setTipoDetalle("cristal");
    setEsAnticipo(false);
    setIdAnticipoSeleccionado("");
    setMontoAplicadoAnticipo("");
    setError("");
    onClose();
  };

  const cambiarEsAnticipo = (valor: boolean) => {
    setEsAnticipo(valor);
    setDetalles([]);
    setIdAnticipoSeleccionado("");
    setMontoAplicadoAnticipo("");
  };

  const guardar = async () => {
    setError("");
    const requeridos: Array<keyof FormState> = ["pedido", "clan", "familia", "proveedor", "fecha_aprobacion", "concepto"];
    const faltante = requeridos.find((campo) => !form[campo].trim());
    if (faltante) {
      setError("Completa los datos requeridos del pedido antes de guardar.");
      return;
    }
    if (!esAnticipo && tipoDetalle === "aluminio" && form.moneda_aluminio === "USD" && !(Number(form.tipo_cambio) > 0)) {
      setError("Indica un tipo de cambio válido (mayor a 0) cuando el aluminio se cotiza en USD.");
      return;
    }
    if (!esAnticipo && idAnticipoSeleccionado && Number(montoAplicadoAnticipo) > 0) {
      const tope = Math.min(anticipoSeleccionado?.saldo_disponible ?? 0, totales.totalFinal);
      if (Number(montoAplicadoAnticipo) > tope + 0.005) {
        setError(`El monto aplicado del anticipo no puede superar ${tope.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
        return;
      }
    }
    setGuardando(true);
    try {
      const payload = {
        pedido: form.pedido.trim(),
        clan: form.clan.trim(),
        familia: form.familia.trim(),
        es_anticipo: esAnticipo,
        proveedor: form.proveedor.trim(),
        fecha_aprobacion: form.fecha_aprobacion,
        concepto: form.concepto.trim(),
        situaciones_especiales: form.situaciones_especiales.trim() || null,
        descripcion_general: tipoDetalle === "cristal" ? form.descripcion_general.trim() || null : null,
        porcentaje_descuento: form.porcentaje_descuento ? Number(form.porcentaje_descuento) : null,
        moneda_aluminio: esAnticipo ? "MXN" : form.moneda_aluminio,
        tipo_cambio: !esAnticipo && form.moneda_aluminio === "USD" ? Number(form.tipo_cambio) : null,
        precio_aluminio_kg: esAnticipo || form.precio_aluminio_kg.trim() === "" ? null : Number(form.precio_aluminio_kg),
        precio_pintura_m2: esAnticipo || form.precio_pintura_m2.trim() === "" ? null : Number(form.precio_pintura_m2),
        detalles,
        ...(!esAnticipo && idAnticipoSeleccionado && Number(montoAplicadoAnticipo) > 0
          ? { id_pedido_anticipo: idAnticipoSeleccionado, monto_aplicado_anticipo: Number(montoAplicadoAnticipo) }
          : {}),
      };
      const pedidoCreado = await apiFetch<Pedido>(`/proyectos/${idProyecto}/pedidos/nuevo`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(pedidoCreado);
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el pedido");
    } finally {
      setGuardando(false);
    }
  };

  const footer = (
    <>
      <button type="button" className="btn-secondary" onClick={cerrar} disabled={guardando}>
        Cancelar
      </button>
      <button type="button" className="btn-primary" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando..." : "Guardar pedido"}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Nuevo pedido" size="xl" footer={footer}>
      <div className="pedido-form">
        {error && <p className="alert error">{error}</p>}

        <div className="pedido-form-card">
          <h4>Datos del pedido</h4>
          <div className="pedido-form-grid">
            <label>
              Pedido*
              <input
                type="text"
                value={form.pedido}
                onChange={(e) => setForm((prev) => ({ ...prev, pedido: e.target.value }))}
                placeholder="Ej. 250"
              />
            </label>
            <label>
              Clan*
              <input
                type="text"
                value={form.clan}
                onChange={(e) => setForm((prev) => ({ ...prev, clan: e.target.value.toUpperCase() }))}
                placeholder="Ej. C1"
              />
            </label>
            <label>
              Familia*
              <input
                type="text"
                value={form.familia}
                onChange={(e) => setForm((prev) => ({ ...prev, familia: e.target.value.toUpperCase() }))}
                placeholder="Ej. CR / AL / MI"
              />
            </label>
            <label>
              Fecha de aprobación*
              <input
                type="date"
                value={form.fecha_aprobacion}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha_aprobacion: e.target.value }))}
              />
            </label>
            <label className="pedido-form-checkbox">
              <input type="checkbox" checked={esAnticipo} onChange={(e) => cambiarEsAnticipo(e.target.checked)} />
              Es anticipo
            </label>
            <label className="span-2">
              Proveedor*
              <input
                type="text"
                value={form.proveedor}
                onChange={(e) => setForm((prev) => ({ ...prev, proveedor: e.target.value }))}
                placeholder="Nombre del proveedor"
              />
            </label>
            <label>
              Concepto*
              <input
                type="text"
                value={form.concepto}
                onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))}
                placeholder="Ej. Material de obra"
              />
            </label>
            <label>
              % Descuento
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.porcentaje_descuento}
                onChange={(e) => setForm((prev) => ({ ...prev, porcentaje_descuento: e.target.value }))}
                placeholder="0"
              />
            </label>
            <label className="span-4">
              Situaciones especiales
              <textarea
                value={form.situaciones_especiales}
                onChange={(e) => setForm((prev) => ({ ...prev, situaciones_especiales: e.target.value }))}
                placeholder="Notas u observaciones (opcional)"
                rows={2}
              />
            </label>
            {tipoDetalle === "cristal" && (
              <label className="span-4">
                Descripción general
                <textarea
                  value={form.descripcion_general}
                  onChange={(e) => setForm((prev) => ({ ...prev, descripcion_general: e.target.value }))}
                  placeholder="Descripción general del pedido (opcional)"
                  rows={2}
                />
              </label>
            )}
            {!esAnticipo && tipoDetalle === "aluminio" && (
              <>
                <label>
                  Moneda del aluminio
                  <select
                    value={form.moneda_aluminio}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, moneda_aluminio: e.target.value as "USD" | "MXN" }))
                    }
                  >
                    <option value="MXN">Pesos (MXN)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </label>
                {form.moneda_aluminio === "USD" && (
                  <label>
                    Tipo de cambio*
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={form.tipo_cambio}
                      onChange={(e) => setForm((prev) => ({ ...prev, tipo_cambio: e.target.value }))}
                      placeholder="Ej. 19.00"
                    />
                  </label>
                )}
                <label>
                  Precio aluminio ($/kg)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio_aluminio_kg}
                    onChange={(e) => setForm((prev) => ({ ...prev, precio_aluminio_kg: e.target.value }))}
                    placeholder="Ej. 4.95"
                  />
                </label>
                <label>
                  Precio pintura ($/m²)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.precio_pintura_m2}
                    onChange={(e) => setForm((prev) => ({ ...prev, precio_pintura_m2: e.target.value }))}
                    placeholder="Ej. 3.04"
                  />
                </label>
              </>
            )}
            {!esAnticipo && anticiposDisponibles.length > 0 && (
              <>
                <label className="span-2">
                  Aplicar anticipo disponible
                  <select
                    value={idAnticipoSeleccionado}
                    onChange={(e) => {
                      setIdAnticipoSeleccionado(e.target.value === "" ? "" : Number(e.target.value));
                      setMontoAplicadoAnticipo("");
                    }}
                  >
                    <option value="">Sin aplicar</option>
                    {anticiposDisponibles.map((a) => (
                      <option key={a.id} value={a.id}>
                        Pedido {a.pedido} — saldo {a.saldo_disponible.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </option>
                    ))}
                  </select>
                </label>
                {idAnticipoSeleccionado !== "" && (
                  <label className="span-2">
                    Monto a aplicar
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={Math.min(anticipoSeleccionado?.saldo_disponible ?? 0, totales.totalFinal)}
                      value={montoAplicadoAnticipo}
                      onChange={(e) => setMontoAplicadoAnticipo(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                )}
              </>
            )}
          </div>
        </div>

        <div className="pedido-form-card">
          <div className="pedido-form-card-header">
            <h4>Líneas de detalle</h4>
            <div className="pedido-form-pills">
              {(["cristal", "aluminio", "miscelaneos"] as TipoDetalle[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  className={`pedido-form-pill${tipoDetalle === tipo ? " active" : ""}`}
                  onClick={() => cambiarTipoDetalle(tipo)}
                >
                  {tipo === "cristal" ? "Cristal" : tipo === "aluminio" ? "Aluminio" : "Misceláneos"}
                </button>
              ))}
            </div>
          </div>
          <DetalleLineasEditor
            tipoDetalle={tipoDetalle}
            detalles={detalles}
            onChange={setDetalles}
            contextoAluminio={!esAnticipo && tipoDetalle === "aluminio" ? contextoAluminio : undefined}
            esAnticipo={esAnticipo}
          />
        </div>

        <div className="pedido-form-totales">
          <div>
            <span>Importe</span>
            <strong>{totales.subtotalBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>Descuento ({totales.porcentajeDescuento.toFixed(2)}%)</span>
            <strong>{totales.descuentoMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>Subtotal</span>
            <strong>{totales.subtotalConDescuento.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div>
            <span>IVA 16%</span>
            <strong>{totales.ivaMonto.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          <div className={esAnticipo || !(idAnticipoSeleccionado !== "" && Number(montoAplicadoAnticipo) > 0) ? "pedido-form-total-final" : ""}>
            <span>{esAnticipo ? "Total" : "Valor del material"}</span>
            <strong>{totales.totalFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
          {!esAnticipo && idAnticipoSeleccionado !== "" && Number(montoAplicadoAnticipo) > 0 && (
            <>
              <div>
                <span>Cubierto por anticipo</span>
                <strong>- {Number(montoAplicadoAnticipo).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="pedido-form-total-final">
                <span>Total a pagar</span>
                <strong>{totales.totalAPagar.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
