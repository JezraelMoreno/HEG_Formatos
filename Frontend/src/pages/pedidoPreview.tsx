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
import type { ContextoAluminio } from "../utils/pedidoDetalleColumns";
import type {
  AnticipoDisponible,
  DetalleUnion,
  EstadoPedido,
  HistorialEstadoItem,
  Pedido,
  TipoDetalle,
} from "../types/pedidos";
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
  const [anticiposDisponibles, setAnticiposDisponibles] = useState<AnticipoDisponible[]>([]);
  const [idAnticipoSeleccionado, setIdAnticipoSeleccionado] = useState<number | "">("");
  const [montoAplicadoAnticipo, setMontoAplicadoAnticipo] = useState("");
  const [anticipoProcesando, setAnticipoProcesando] = useState(false);
  const [anticipoError, setAnticipoError] = useState("");

  const tipoDetalle = useMemo(() => tipoDetalleDeFamilia(pedido?.familia), [pedido?.familia]);
  const esAnticipo = !!pedido?.es_anticipo;
  const totales = usePedidoTotales(detalles, pedido?.porcentaje_descuento, esAnticipo ? 0 : pedido?.monto_cubierto_anticipo);
  const puedeEditarAhora = puedeGestionar && pedido?.estado !== "rechazado";
  const anticipoSeleccionado = anticiposDisponibles.find((a) => a.id === idAnticipoSeleccionado);

  const contextoAluminio: ContextoAluminio = useMemo(
    () => ({
      monedaAluminio: pedido?.moneda_aluminio === "USD" ? "USD" : "MXN",
      tipoCambio: Number(pedido?.tipo_cambio || 1),
      precioAluminioKg: pedido?.precio_aluminio_kg ?? null,
      precioPinturaM2: pedido?.precio_pintura_m2 ?? null,
    }),
    [pedido?.moneda_aluminio, pedido?.tipo_cambio, pedido?.precio_aluminio_kg, pedido?.precio_pintura_m2]
  );

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

  useEffect(() => {
    setIdAnticipoSeleccionado("");
    setMontoAplicadoAnticipo("");
    setAnticipoError("");
    if (!pedido || esAnticipo || pedido.aplicacion_anticipo || !puedeEditarAhora || !pedido.familia) {
      setAnticiposDisponibles([]);
      return;
    }
    apiFetch<AnticipoDisponible[]>(
      `/proyectos/${pedido.id_proyecto}/anticipos-disponibles?familia=${encodeURIComponent(pedido.familia)}`
    )
      .then((data) => setAnticiposDisponibles(Array.isArray(data) ? data : []))
      .catch(() => setAnticiposDisponibles([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.id, pedido?.familia, pedido?.aplicacion_anticipo, puedeEditarAhora, esAnticipo]);

  const aplicarAnticipoSeleccionado = async () => {
    if (!pedidoId || idAnticipoSeleccionado === "" || !(Number(montoAplicadoAnticipo) > 0)) return;
    setAnticipoProcesando(true);
    setAnticipoError("");
    try {
      await apiFetch(`/pedidos/${pedidoId}/anticipo`, {
        method: "POST",
        body: JSON.stringify({ id_pedido_anticipo: idAnticipoSeleccionado, monto_aplicado: Number(montoAplicadoAnticipo) }),
      });
      await cargar();
    } catch (e) {
      setAnticipoError(e instanceof Error ? e.message : "No se pudo aplicar el anticipo");
    } finally {
      setAnticipoProcesando(false);
    }
  };

  const quitarAnticipoAplicado = async () => {
    if (!pedidoId) return;
    setAnticipoProcesando(true);
    setAnticipoError("");
    try {
      await apiFetch(`/pedidos/${pedidoId}/anticipo`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      setAnticipoError(e instanceof Error ? e.message : "No se pudo quitar el anticipo aplicado");
    } finally {
      setAnticipoProcesando(false);
    }
  };

  const actualizarCampo = (campo: keyof Pedido, valor: string) => {
    setPedido((prev) => (prev ? ({ ...prev, [campo]: valor } as Pedido) : prev));
  };

  const guardarCambios = async () => {
    if (!pedido || !pedidoId) return;
    setGuardando(true);
    setAccionError("");
    setAccionMensaje("");
    try {
      if (tipoDetalle === "aluminio" && pedido.moneda_aluminio === "USD" && !(Number(pedido.tipo_cambio) > 0)) {
        setAccionError("Indica un tipo de cambio válido (mayor a 0) cuando el aluminio se cotiza en USD.");
        setGuardando(false);
        return;
      }
      const payload = {
        pedido: pedido.pedido,
        clan: pedido.clan,
        familia: pedido.familia,
        proveedor: pedido.proveedor,
        fecha_aprobacion: pedido.fecha_aprobacion,
        concepto: pedido.concepto,
        situaciones_especiales: pedido.situaciones_especiales,
        descripcion_general: tipoDetalle === "cristal" ? pedido.descripcion_general : null,
        porcentaje_descuento: pedido.porcentaje_descuento,
        moneda_aluminio: pedido.moneda_aluminio || "MXN",
        tipo_cambio: pedido.moneda_aluminio === "USD" ? Number(pedido.tipo_cambio) : null,
        precio_aluminio_kg: pedido.precio_aluminio_kg ?? null,
        precio_pintura_m2: pedido.precio_pintura_m2 ?? null,
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
                    {tipoDetalle === "cristal" && (
                      <label className="span-4">
                        Descripción general
                        <textarea
                          value={pedido.descripcion_general || ""}
                          disabled={!puedeEditarAhora}
                          onChange={(e) => actualizarCampo("descripcion_general", e.target.value)}
                          rows={2}
                        />
                      </label>
                    )}
                    {!esAnticipo && tipoDetalle === "aluminio" && (
                      <>
                        <label>
                          Moneda del aluminio
                          <select
                            value={pedido.moneda_aluminio || "MXN"}
                            disabled={!puedeEditarAhora}
                            onChange={(e) => actualizarCampo("moneda_aluminio", e.target.value)}
                          >
                            <option value="MXN">Pesos (MXN)</option>
                            <option value="USD">Dólares (USD)</option>
                          </select>
                        </label>
                        {pedido.moneda_aluminio === "USD" && (
                          <label>
                            Tipo de cambio*
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              value={pedido.tipo_cambio ?? ""}
                              disabled={!puedeEditarAhora}
                              onChange={(e) => actualizarCampo("tipo_cambio", e.target.value)}
                            />
                          </label>
                        )}
                        <label>
                          Precio aluminio ($/kg)
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pedido.precio_aluminio_kg ?? ""}
                            disabled={!puedeEditarAhora}
                            onChange={(e) => actualizarCampo("precio_aluminio_kg", e.target.value)}
                          />
                        </label>
                        <label>
                          Precio pintura ($/m²)
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pedido.precio_pintura_m2 ?? ""}
                            disabled={!puedeEditarAhora}
                            onChange={(e) => actualizarCampo("precio_pintura_m2", e.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>

                <div className="pedido-form-card">
                  <h4>Anticipo</h4>
                  {anticipoError && <p className="alert error">{anticipoError}</p>}
                  {esAnticipo ? (
                    <>
                      <div className="anticipo-saldo">
                        <span>Saldo disponible</span>
                        <strong>{formatCurrency(pedido.saldo_anticipo?.saldo_disponible)}</strong>
                        <span className="anticipo-saldo-detalle">
                          de {formatCurrency(pedido.saldo_anticipo?.monto_total)} — aplicado {formatCurrency(pedido.saldo_anticipo?.monto_aplicado)}
                        </span>
                      </div>
                      {pedido.aplicaciones && pedido.aplicaciones.length > 0 ? (
                        <ul className="anticipo-aplicaciones-lista">
                          {pedido.aplicaciones.map((a) => (
                            <li key={a.id}>
                              <div>
                                <strong>Pedido {a.pedido_destino}</strong>
                                <span className="historial-meta">{a.concepto_destino}</span>
                              </div>
                              <div className="anticipo-aplicaciones-monto">
                                <strong>{formatCurrency(a.monto_aplicado)}</strong>
                                <span className="historial-meta">{formatFechaHora(a.fecha_registro)} · {a.nombre_usuario}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="pedido-preview-historial-vacio">Aún no se ha aplicado a ningún pedido.</p>
                      )}
                    </>
                  ) : pedido.aplicacion_anticipo ? (
                    <div className="anticipo-cubierto">
                      <div>
                        <span>Cubierto por anticipo {pedido.aplicacion_anticipo.pedido_anticipo}</span>
                        <strong>{formatCurrency(pedido.aplicacion_anticipo.monto_aplicado)}</strong>
                      </div>
                      {puedeEditarAhora && (
                        <button type="button" className="btn-secondary" onClick={quitarAnticipoAplicado} disabled={anticipoProcesando}>
                          {anticipoProcesando ? "Quitando..." : "Quitar"}
                        </button>
                      )}
                    </div>
                  ) : puedeEditarAhora && anticiposDisponibles.length > 0 ? (
                    <div className="pedido-form-grid">
                      <label className="span-2">
                        Anticipo disponible
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
                        <>
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
                          <button
                            type="button"
                            className="btn-primary span-2"
                            onClick={aplicarAnticipoSeleccionado}
                            disabled={anticipoProcesando || !(Number(montoAplicadoAnticipo) > 0)}
                          >
                            {anticipoProcesando ? "Aplicando..." : "Aplicar anticipo"}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="pedido-preview-historial-vacio">Sin anticipo aplicado.</p>
                  )}
                </div>

                <div className="pedido-form-card">
                  <h4>Líneas de detalle</h4>
                  <DetalleLineasEditor
                    tipoDetalle={tipoDetalle}
                    detalles={detalles}
                    onChange={setDetalles}
                    disabled={!puedeEditarAhora}
                    contextoAluminio={!esAnticipo && tipoDetalle === "aluminio" ? contextoAluminio : undefined}
                    esAnticipo={esAnticipo}
                  />
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
                  <div className={esAnticipo || !(Number(pedido.monto_cubierto_anticipo) > 0) ? "pedido-form-total-final" : ""}>
                    <span>{esAnticipo ? "Total" : "Valor del material"}</span>
                    <strong>{formatCurrency(totales.totalFinal)}</strong>
                  </div>
                  {!esAnticipo && Number(pedido.monto_cubierto_anticipo) > 0 && (
                    <>
                      <div>
                        <span>Cubierto por anticipo</span>
                        <strong>- {formatCurrency(pedido.monto_cubierto_anticipo)}</strong>
                      </div>
                      <div className="pedido-form-total-final">
                        <span>Total a pagar</span>
                        <strong>{formatCurrency(totales.totalAPagar)}</strong>
                      </div>
                    </>
                  )}
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
                      disabled={cambiandoEstado || (esAnticipo && (pedido.aplicaciones?.length ?? 0) > 0)}
                      title={
                        esAnticipo && (pedido.aplicaciones?.length ?? 0) > 0
                          ? "No se puede rechazar un anticipo con aplicaciones registradas"
                          : undefined
                      }
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
