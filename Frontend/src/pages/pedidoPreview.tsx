import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Topbar } from "../components/Topbar";
import { EstadoBadge } from "../components/EstadoBadge";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { usePedidoTotales } from "../hooks/usePedidoTotales";
import { apiFetch } from "../api/client";
import { authHeader } from "../auth";
import API_URL from "../config";
import { DetalleLineasEditor } from "./pedidos/DetalleLineasEditor";
import type { DetalleUnion, EstadoPedido, HistorialEstadoItem, Pedido, TipoDetalle } from "../types/pedidos";
import "./pedidos/PedidoFormModal.css";
import "./pedidoPreview.css";

type PedidoConDetalles = Pedido & { detalles: DetalleUnion[] };

const formatCurrency = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatFechaHora = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const normalizado = iso.includes("T") ? iso : iso.replace(" ", "T");
  const date = new Date(normalizado);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

const tipoDetalleDeFamilia = (familia: string | null | undefined): TipoDetalle => {
  const f = (familia || "").trim().toUpperCase();
  if (f === "CR") return "cristal";
  if (f === "AL" || f === "MQAL") return "aluminio";
  return "miscelaneos";
};

const ESTADO_LABEL: Record<EstadoPedido, string> = {
  levantado: "Levantado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

type PasoStepper = { key: EstadoPedido; label: string; estado: "done" | "active" | "rejected" | "todo" };

function pasosStepper(estadoActual: EstadoPedido | undefined): PasoStepper[] {
  return [
    { key: "levantado", label: "Levantado", estado: "done" },
    {
      key: "aprobado",
      label: "Aprobado",
      estado: estadoActual === "aprobado" ? "active" : estadoActual === "rechazado" ? "todo" : "todo",
    },
    {
      key: "rechazado",
      label: "Rechazado",
      estado: estadoActual === "rechazado" ? "rejected" : "todo",
    },
  ];
}

export function PedidoPreview() {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const { isAprobador, isSuperadmin } = useAuth();
  const puedeGestionar = isAprobador || isSuperadmin;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [detalles, setDetalles] = useState<DetalleUnion[]>([]);
  const [historial, setHistorial] = useState<HistorialEstadoItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [modalRechazo, setModalRechazo] = useState(false);
  const [comentarioRechazo, setComentarioRechazo] = useState("");
  const [accionError, setAccionError] = useState("");
  const [accionMensaje, setAccionMensaje] = useState("");
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const tipoDetalle = useMemo(() => tipoDetalleDeFamilia(pedido?.familia), [pedido?.familia]);
  const totales = usePedidoTotales(detalles, pedido?.porcentaje_descuento);
  const puedeEditarAhora = puedeGestionar && pedido?.estado !== "rechazado";

  const cargar = useCallback(async () => {
    if (!pedidoId) return;
    setCargando(true);
    setError("");
    try {
      const pedidoData = await apiFetch<PedidoConDetalles>(`/pedidos/${pedidoId}`);
      const { detalles: detallesData, ...pedidoSolo } = pedidoData;
      setPedido(pedidoSolo as Pedido);
      setDetalles(Array.isArray(detallesData) ? detallesData : []);
      try {
        const historialData = await apiFetch<HistorialEstadoItem[]>(`/pedidos/${pedidoId}/historial`);
        setHistorial(Array.isArray(historialData) ? historialData : []);
      } catch {
        setHistorial([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el pedido");
    } finally {
      setCargando(false);
    }
  }, [pedidoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actualizarCampo = (campo: keyof Pedido, valor: string) => {
    setPedido((prev) => (prev ? ({ ...prev, [campo]: valor } as Pedido) : prev));
  };

  const guardarCambios = async () => {
    if (!pedido || !pedidoId) return;
    setGuardando(true);
    setAccionError("");
    setAccionMensaje("");
    try {
      const payload = {
        pedido: pedido.pedido,
        clan: pedido.clan,
        familia: pedido.familia,
        proveedor: pedido.proveedor,
        fecha_aprobacion: pedido.fecha_aprobacion,
        concepto: pedido.concepto,
        situaciones_especiales: pedido.situaciones_especiales,
        porcentaje_descuento: pedido.porcentaje_descuento,
        detalles,
        reemplazar: true,
      };
      const actualizado = await apiFetch<PedidoConDetalles>(`/pedidos/${pedidoId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const { detalles: detallesData, ...pedidoSolo } = actualizado;
      setPedido(pedidoSolo as Pedido);
      setDetalles(Array.isArray(detallesData) ? detallesData : []);
      setAccionMensaje("Cambios guardados");
    } catch (e) {
      setAccionError(e instanceof Error ? e.message : "No se pudieron guardar los cambios");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (estado: EstadoPedido, comentario?: string) => {
    if (!pedidoId) return;
    setCambiandoEstado(true);
    setAccionError("");
    setAccionMensaje("");
    try {
      await apiFetch(`/pedidos/${pedidoId}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado, comentario }),
      });
      await cargar();
      setModalRechazo(false);
      setComentarioRechazo("");
    } catch (e) {
      setAccionError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setCambiandoEstado(false);
    }
  };

  const aprobar = () => {
    cambiarEstado("aprobado");
  };

  const confirmarRechazo = () => {
    if (!comentarioRechazo.trim()) {
      setAccionError("El comentario es obligatorio al rechazar un pedido.");
      return;
    }
    cambiarEstado("rechazado", comentarioRechazo.trim());
  };

  const descargarPdf = async () => {
    if (!pedidoId) return;
    setDescargandoPdf(true);
    setAccionError("");
    try {
      const res = await fetch(`${API_URL}/pedidos/${pedidoId}/pdf`, { headers: { ...authHeader() } });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "No se pudo generar el PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const nombreArchivo = match ? match[1] : `Pedido_${pedido?.pedido || pedidoId}.pdf`;
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setAccionError(e instanceof Error ? e.message : "No se pudo descargar el PDF");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const sidebarItems = [
    { key: "pedidos", label: "Pedidos", active: true, onClick: () => navigate("/home") },
    { key: "contabilidad", label: "Contabilidad", active: false, onClick: () => navigate("/home") },
    { key: "viaticos", label: "Viáticos", active: false, onClick: () => navigate("/home") },
    { key: "dashboards", label: "Dashboards", active: false, onClick: () => navigate("/home") },
    { key: "remisiones", label: "Remisiones", active: false, onClick: () => navigate("/home") },
  ];

  const ultimaActualizacion = historial.length > 0 ? historial[historial.length - 1].fecha_registro : pedido?.fecha_levantado;

  return (
    <AppShell items={sidebarItems}>
      <Topbar title={pedido ? `Pedido ${pedido.pedido}` : "Vista previa"} onBack={() => navigate(-1)}>
        <button type="button" className="btn-secondary" onClick={() => window.print()}>
          Imprimir
        </button>
        <button type="button" className="btn-secondary" onClick={descargarPdf} disabled={descargandoPdf || !pedido}>
          {descargandoPdf ? "Generando PDF..." : "Descargar PDF"}
        </button>
      </Topbar>

      <div className="app-shell-content">
        {error && <p className="alert error">{error}</p>}
        {cargando ? (
          <p>Cargando vista previa...</p>
        ) : !pedido ? (
          <p>No se encontró el pedido.</p>
        ) : (
          <div className="pedido-preview-layout">
            <div className="pedido-preview-header">
              <EstadoBadge estado={pedido.estado} />
              <div className="pedido-preview-stepper">
                {pasosStepper(pedido.estado).map((paso, idx, arr) => (
                  <div key={paso.key} className={`stepper-step stepper-${paso.estado}`}>
                    <span className="stepper-circle">
                      {paso.estado === "done" || paso.estado === "active" ? "✓" : paso.estado === "rejected" ? "✕" : idx + 1}
                    </span>
                    <span className="stepper-label">{paso.label}</span>
                    {idx < arr.length - 1 && <span className="stepper-bar" />}
                  </div>
                ))}
              </div>
              <span className="pedido-preview-updated">Última actualización: {formatFechaHora(ultimaActualizacion)}</span>
            </div>

            <div className="pedido-preview-grid">
              <div className="pedido-preview-main">
                <div className="pedido-form-card">
                  <h4>Datos del pedido</h4>
                  <div className="pedido-form-grid">
                    <label>
                      Pedido
                      <input type="text" value={pedido.pedido || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("pedido", e.target.value)} />
                    </label>
                    <label>
                      Clan
                      <input type="text" value={pedido.clan || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("clan", e.target.value.toUpperCase())} />
                    </label>
                    <label>
                      Familia
                      <input type="text" value={pedido.familia || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("familia", e.target.value.toUpperCase())} />
                    </label>
                    <label>
                      Fecha de aprobación
                      <input type="date" value={pedido.fecha_aprobacion || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("fecha_aprobacion", e.target.value)} />
                    </label>
                    <label className="span-2">
                      Proveedor
                      <input type="text" value={pedido.proveedor || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("proveedor", e.target.value)} />
                    </label>
                    <label>
                      Concepto
                      <input type="text" value={pedido.concepto || ""} disabled={!puedeEditarAhora} onChange={(e) => actualizarCampo("concepto", e.target.value)} />
                    </label>
                    <label>
                      % Descuento
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={pedido.porcentaje_descuento ?? ""}
                        disabled={!puedeEditarAhora}
                        onChange={(e) => actualizarCampo("porcentaje_descuento", e.target.value)}
                      />
                    </label>
                    <label className="span-4">
                      Situaciones especiales
                      <textarea
                        value={pedido.situaciones_especiales || ""}
                        disabled={!puedeEditarAhora}
                        onChange={(e) => actualizarCampo("situaciones_especiales", e.target.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                </div>

                <div className="pedido-form-card">
                  <h4>Líneas de detalle</h4>
                  <DetalleLineasEditor tipoDetalle={tipoDetalle} detalles={detalles} onChange={setDetalles} disabled={!puedeEditarAhora} />
                </div>

                <div className="pedido-form-totales">
                  <div>
                    <span>Importe</span>
                    <strong>{formatCurrency(totales.subtotalBase)}</strong>
                  </div>
                  <div>
                    <span>Descuento ({totales.porcentajeDescuento.toFixed(2)}%)</span>
                    <strong>{formatCurrency(totales.descuentoMonto)}</strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>{formatCurrency(totales.subtotalConDescuento)}</strong>
                  </div>
                  <div>
                    <span>IVA 16%</span>
                    <strong>{formatCurrency(totales.ivaMonto)}</strong>
                  </div>
                  <div className="pedido-form-total-final">
                    <span>Total</span>
                    <strong>{formatCurrency(totales.totalFinal)}</strong>
                  </div>
                </div>
              </div>

              <aside className="pedido-preview-rail">
                {accionError && <p className="alert error">{accionError}</p>}
                {accionMensaje && <p className="alert success">{accionMensaje}</p>}

                {puedeEditarAhora && (
                  <div className="pedido-preview-actions">
                    <button type="button" className="btn-primary" onClick={guardarCambios} disabled={guardando}>
                      {guardando ? "Guardando..." : "Guardar cambios"}
                    </button>
                    <button type="button" className="pedido-preview-approve" onClick={aprobar} disabled={cambiandoEstado || pedido.estado === "aprobado"}>
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        setAccionError("");
                        setModalRechazo(true);
                      }}
                      disabled={cambiandoEstado}
                    >
                      Rechazar
                    </button>
                  </div>
                )}

                <div className="pedido-preview-historial">
                  <h4>Historial de estados</h4>
                  {historial.length === 0 ? (
                    <p className="pedido-preview-historial-vacio">Sin movimientos registrados.</p>
                  ) : (
                    <ul>
                      {[...historial].reverse().map((h) => (
                        <li key={h.id} className={`historial-item historial-${h.estado_nuevo}`}>
                          <span className="historial-dot" />
                          <div>
                            <strong>{ESTADO_LABEL[h.estado_nuevo] || h.estado_nuevo}</strong>
                            <span className="historial-meta">
                              {formatFechaHora(h.fecha_registro)} · {h.nombre_usuario}
                            </span>
                            {h.comentario && <p className="historial-comentario">{h.comentario}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalRechazo}
        onClose={() => {
          setModalRechazo(false);
          setComentarioRechazo("");
        }}
        title="Rechazar pedido"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setModalRechazo(false)} disabled={cambiandoEstado}>
              Cancelar
            </button>
            <button type="button" className="btn-danger" onClick={confirmarRechazo} disabled={cambiandoEstado}>
              {cambiandoEstado ? "Rechazando..." : "Confirmar rechazo"}
            </button>
          </>
        }
      >
        {modalRechazo && accionError && <p className="alert error">{accionError}</p>}
        <label className="pedido-preview-comentario-label">
          Comentario*
          <textarea
            value={comentarioRechazo}
            onChange={(e) => setComentarioRechazo(e.target.value)}
            placeholder="Explica por qué se rechaza este pedido (obligatorio, queda en el historial)"
            rows={4}
          />
        </label>
      </Modal>
    </AppShell>
  );
}
