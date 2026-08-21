import { useState } from "react";
import { Modal } from "../../components/Modal";
import { DetalleLineasEditor } from "./DetalleLineasEditor";
import { usePedidoTotales } from "../../hooks/usePedidoTotales";
import { apiFetch } from "../../api/client";
import type { DetalleUnion, Pedido, TipoDetalle } from "../../types/pedidos";
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

  const totales = usePedidoTotales(detalles, Number(form.porcentaje_descuento || 0));

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
    setError("");
    onClose();
  };

  const guardar = async () => {
    setError("");
    const requeridos: Array<keyof FormState> = ["pedido", "clan", "familia", "proveedor", "fecha_aprobacion", "concepto"];
    const faltante = requeridos.find((campo) => !form[campo].trim());
    if (faltante) {
      setError("Completa los datos requeridos del pedido antes de guardar.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        pedido: form.pedido.trim(),
        clan: form.clan.trim(),
        familia: form.familia.trim(),
        proveedor: form.proveedor.trim(),
        fecha_aprobacion: form.fecha_aprobacion,
        concepto: form.concepto.trim(),
        situaciones_especiales: form.situaciones_especiales.trim() || null,
        porcentaje_descuento: form.porcentaje_descuento ? Number(form.porcentaje_descuento) : null,
        detalles,
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
          <DetalleLineasEditor tipoDetalle={tipoDetalle} detalles={detalles} onChange={setDetalles} />
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
          <div className="pedido-form-total-final">
            <span>Total</span>
            <strong>{totales.totalFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
}
