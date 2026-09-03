import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, MouseEvent, SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./ProyectosSelectorPage.css";
import "../mainPage.css";
import API_URL from "../../config";
import { authHeader, clearToken } from "../../auth";
import { useAuth } from "../../hooks/useAuth";
import { useActiveProject } from "../../context/useActiveProject";
import type { Proyecto } from "../../context/ProjectContextTypes";
import { listarProyectos } from "../../services/proyectos";
import { getRecentProjects } from "../../utils/recentProjects";
import {
  calcularPresupuesto,
  deriveEstado,
  deriveIniciales,
  ESTADO_BADGE_VARS,
  ESTADO_LABELS,
  formatCurrency,
  formatearFecha,
  tileColorsFor,
} from "../../utils/proyectoDisplay";

type FiltroEstado = "activos" | "cerrados" | "todos";

const TrashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export function ProyectosSelectorPage() {
  const navigate = useNavigate();
  const { username, role, isSuperadmin: isAdmin } = useAuth();
  const { setProyectoActivo, limpiarProyecto } = useActiveProject();

  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensajeGeneral, setMensajeGeneral] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("activos");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [presupuestoCristal, setPresupuestoCristal] = useState("");
  const [presupuestoAluminio, setPresupuestoAluminio] = useState("");
  const [miscelFamilias, setMiscelFamilias] = useState<Array<{ id: number; familia: string; presupuesto: string }>>([]);
  const [miscelInput, setMiscelInput] = useState({ familia: "", presupuesto: "" });

  const [proyectoAEliminar, setProyectoAEliminar] = useState<Proyecto | null>(null);
  const [confirmacionProyecto, setConfirmacionProyecto] = useState("");
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false);

  const inicial = (username || "?").trim().charAt(0).toUpperCase();
  const rolLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "";

  const cargarProyectos = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listarProyectos();
      setProyectos(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando proyectos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  useEffect(() => {
    if (!mensajeGeneral) return;
    const timeout = setTimeout(() => setMensajeGeneral(""), 2000);
    return () => clearTimeout(timeout);
  }, [mensajeGeneral]);

  const totalMiscel = miscelFamilias.reduce((sum, f) => {
    const n = Number(f.presupuesto);
    return Number.isFinite(n) && n >= 0 ? sum + n : sum;
  }, 0);
  const presupuestoTotalPreview = [presupuestoCristal, presupuestoAluminio].reduce((sum, val) => {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? sum + num : sum;
  }, totalMiscel);

  const proyectosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return proyectos.filter((p) => {
      const coincideBusqueda = !term || p.nombre.toLowerCase().includes(term);
      const coincideEstado =
        filtroEstado === "todos" ||
        (filtroEstado === "activos" && p.estado === "en_progreso") ||
        (filtroEstado === "cerrados" && p.estado === "completado");
      return coincideBusqueda && coincideEstado;
    });
  }, [proyectos, busqueda, filtroEstado]);

  const recientes = useMemo(() => {
    const porId = new Map(proyectos.map((p) => [p.id_proyecto, p]));
    return getRecentProjects()
      .map((r) => porId.get(r.id_proyecto))
      .filter((p): p is Proyecto => Boolean(p))
      .slice(0, 3);
  }, [proyectos]);

  const entrarAProyecto = (p: Proyecto) => {
    setProyectoActivo(p);
    navigate("/home");
  };

  const handleLogout = () => {
    limpiarProyecto();
    clearToken();
    navigate("/");
  };

  const abrirModal = () => setModalAbierto(true);
  const cerrarModal = () => {
    setModalAbierto(false);
    setNombre("");
    setFecha("");
    setPresupuestoCristal("");
    setPresupuestoAluminio("");
    setMiscelFamilias([]);
    setMiscelInput({ familia: "", presupuesto: "" });
    setError("");
  };

  const crearProyecto = async (e: FormEvent) => {
    e.preventDefault();
    const parseBudgetInput = (value: string) => {
      if (value.trim() === "") return 0;
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? Number(num.toFixed(2)) : NaN;
    };
    const cristalNum = parseBudgetInput(presupuestoCristal);
    const aluminioNum = parseBudgetInput(presupuestoAluminio);
    if (!nombre || !fecha || [cristalNum, aluminioNum].some((n) => Number.isNaN(n))) {
      setError("Completa nombre, fecha y presupuestos válidos (usa 0 si no aplica)");
      return;
    }
    try {
      setError("");
      const res = await fetch(`${API_URL}/proyectos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          nombre,
          fecha_proyecto: fecha,
          presupuesto_cristal: cristalNum,
          presupuesto_aluminio: aluminioNum,
          miscel_familias: miscelFamilias.map((f) => ({
            familia: f.familia.trim().toUpperCase(),
            presupuesto: Number(f.presupuesto),
          })),
        }),
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        cerrarModal();
        cargarProyectos();
      } else {
        setError(data?.message || "No se pudo crear el proyecto");
      }
    } catch {
      setError("Error de conexión con el servidor");
    }
  };

  const generarCobranzaTotal = async () => {
    try {
      setError("");
      const res = await fetch(`${API_URL}/cobranza/export`, { headers: { ...authHeader() } });
      if (!res.ok) {
        setError("No se pudo generar cobranza total");
        return;
      }
      const cd = res.headers.get("Content-Disposition") || "";
      let filename = "cobranza_total.xlsx";
      const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
      if (m) filename = m[1];
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error de conexión al generar cobranza total");
    }
  };

  const abrirConfirmacionEliminar = (proyecto: Proyecto, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setProyectoAEliminar(proyecto);
    setConfirmacionProyecto("");
    setError("");
  };

  const cerrarConfirmacionEliminar = () => {
    setProyectoAEliminar(null);
    setConfirmacionProyecto("");
    setEliminandoProyecto(false);
  };

  const confirmacionCoincide = proyectoAEliminar
    ? confirmacionProyecto.trim().toLowerCase() === proyectoAEliminar.nombre.trim().toLowerCase()
    : false;

  const eliminarProyecto = async () => {
    if (!proyectoAEliminar || !confirmacionCoincide) return;
    try {
      setEliminandoProyecto(true);
      setError("");
      const res = await fetch(`${API_URL}/proyectos/${proyectoAEliminar.id_proyecto}`, {
        method: "DELETE",
        headers: { ...authHeader() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || "No se pudo eliminar el proyecto");
        return;
      }
      setMensajeGeneral(data?.message || "Proyecto eliminado correctamente");
      cerrarConfirmacionEliminar();
      await cargarProyectos();
    } catch {
      setError("Error de conexión al eliminar proyecto");
    } finally {
      setEliminandoProyecto(false);
    }
  };

  const cambiarEstadoProyecto = async (
    idProyecto: number,
    nuevoEstado: "en_progreso" | "completado",
    event: SyntheticEvent
  ) => {
    event.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/proyectos/${idProyecto}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || "No se pudo actualizar el estado del proyecto");
        return;
      }
      setMensajeGeneral(`Estado del proyecto actualizado a: ${nuevoEstado === "en_progreso" ? "En Progreso" : "Completado"}`);
      await cargarProyectos();
    } catch {
      setError("Error de conexión al cambiar estado del proyecto");
    }
  };

  return (
    <div className="proy-selector">
      <header className="proy-topbar">
        <div className="proy-topbar-brand">
          <span className="proy-topbar-logo">
            <img src={`${API_URL}/assets/heg_logo.jpg`} alt="HEG" />
          </span>
          <span className="proy-topbar-name">HEG Formatos</span>
        </div>
        <div className="proy-topbar-actions">
          <div className="proy-user-pill">
            <span className="proy-user-avatar">{inicial}</span>
            <div className="proy-user-info">
              <span className="proy-user-name">{username || "Usuario"}</span>
              <span className="proy-user-role">{rolLabel}</span>
            </div>
          </div>
          <button type="button" className="action-button secondary-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className="proy-body">
        <div className="proy-header-row">
          <div className="proy-heading">
            <span className="proy-eyebrow">Paso 1 de 2</span>
            <h1>Selecciona proyecto</h1>
            <p>Al elegir uno, los módulos se abren ya filtrados por esa obra.</p>
          </div>
          <div className="proy-controls">
            <div className="search-bar proy-search">
              <label htmlFor="proy-busqueda" className="visually-hidden">
                Buscar proyecto
              </label>
              <input
                id="proy-busqueda"
                type="text"
                placeholder="Buscar proyecto"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <div className="proy-pills">
              {(["activos", "cerrados", "todos"] as FiltroEstado[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`proy-pill${filtroEstado === f ? " active" : ""}`}
                  onClick={() => setFiltroEstado(f)}
                >
                  {f === "activos" ? "Activos" : f === "cerrados" ? "Cerrados" : "Todos"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="proy-admin-actions">
          <button type="button" className="action-button create-button" onClick={abrirModal}>
            Crear proyecto
          </button>
          <button type="button" className="action-button create-button" onClick={generarCobranzaTotal}>
            Generar cobranza total
          </button>
        </div>

        {(error || mensajeGeneral) && (
          <div className="mensajes-globales">
            {error && <p className="error-text">{error}</p>}
            {mensajeGeneral && <p className="success-text">{mensajeGeneral}</p>}
          </div>
        )}

        {recientes.length > 0 && (
          <div className="proy-recientes">
            <div className="proy-recientes-label">Recientes</div>
            <div className="proy-recientes-chips">
              {recientes.map((p) => {
                const colors = tileColorsFor(p.id_proyecto);
                return (
                  <button key={p.id_proyecto} type="button" className="proy-chip" onClick={() => entrarAProyecto(p)}>
                    <span className="proy-chip-ini" style={{ background: colors.tint, color: colors.accent }}>
                      {deriveIniciales(p.nombre)}
                    </span>
                    <span className="proy-chip-nombre">{p.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="proy-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="proy-skeleton" />
            ))}
          </div>
        ) : proyectosFiltrados.length === 0 ? (
          <div className="proy-empty">
            {proyectos.length === 0
              ? "No tienes proyectos asignados todavía."
              : "No se encontraron proyectos que coincidan con los filtros."}
          </div>
        ) : (
          <div className="proy-grid">
            {proyectosFiltrados.map((p) => {
              const estado = deriveEstado(p);
              const badge = ESTADO_BADGE_VARS[estado];
              const { gastado, asignado, pctEjercido, sobregirado } = calcularPresupuesto(p);
              const colors = tileColorsFor(p.id_proyecto);
              return (
                <div
                  key={p.id_proyecto}
                  className="proy-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => entrarAProyecto(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      entrarAProyecto(p);
                    }
                  }}
                  style={{ "--proy-accent": colors.accent } as CSSProperties}
                >
                  <div className="proy-card-top">
                    <span className="proy-card-ini" style={{ background: colors.tint, color: colors.accent }}>
                      {deriveIniciales(p.nombre)}
                    </span>
                    <div className="proy-card-titulo">
                      <h3>{p.nombre}</h3>
                      <span className="proy-card-fecha">{formatearFecha(p.fecha_proyecto)}</span>
                    </div>
                    <span className="proy-card-badge" style={{ background: badge.bg, color: badge.text }}>
                      {ESTADO_LABELS[estado]}
                    </span>
                  </div>

                  <div className="proy-card-ejercido">
                    <div className="proy-card-ejercido-labels">
                      <span>Ejercido {pctEjercido}%</span>
                      <span>
                        {formatCurrency(gastado)} / {formatCurrency(asignado)}
                      </span>
                    </div>
                    <div className="proy-card-bar">
                      <div
                        className="proy-card-bar-fill"
                        style={{
                          width: `${Math.min(pctEjercido, 100)}%`,
                          background: sobregirado ? "var(--color-danger)" : "var(--color-accent)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="proy-card-chips">
                    <span className="proy-card-chip cr">CR {formatCurrency(p.presupuesto_cristal)}</span>
                    <span className="proy-card-chip al">AL {formatCurrency(p.presupuesto_aluminio)}</span>
                    <span className="proy-card-chip mi">MI {formatCurrency(p.presupuesto_miscelaneos)}</span>
                  </div>

                  {isAdmin && (
                    <div className="proy-card-estado-row estado-selector" onClick={(e) => e.stopPropagation()}>
                      <label htmlFor={`proy-estado-${p.id_proyecto}`}>Estado:</label>
                      <select
                        id={`proy-estado-${p.id_proyecto}`}
                        value={p.estado}
                        onChange={(e) =>
                          cambiarEstadoProyecto(p.id_proyecto, e.target.value as "en_progreso" | "completado", e)
                        }
                        className={`estado-select ${p.estado === "completado" ? "completado" : "en-progreso"}`}
                      >
                        <option value="en_progreso">En Progreso</option>
                        <option value="completado">Completado</option>
                      </select>
                    </div>
                  )}

                  <div className="proy-card-footer">
                    <span className="proy-card-arrow">Entrar →</span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="icon-button trash-button"
                        aria-label={`Eliminar proyecto ${p.nombre}`}
                        onClick={(event) => abrirConfirmacionEliminar(p, event)}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Crear proyecto</h3>
            {error && <p className="error-text">{error}</p>}
            <form onSubmit={crearProyecto} className="form-proyecto">
              <label>Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del proyecto"
                required
              />
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              <label>Presupuesto cristal</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={presupuestoCristal}
                onChange={(e) => setPresupuestoCristal(e.target.value)}
                placeholder="Presupuesto para cristal"
                required
              />
              <label>Presupuesto aluminio</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={presupuestoAluminio}
                onChange={(e) => setPresupuestoAluminio(e.target.value)}
                placeholder="Presupuesto para aluminio"
                required
              />
              <label>Presupuesto misceláneos (por familia)</label>
              {miscelFamilias.length > 0 && (
                <div className="miscel-familias-list">
                  {miscelFamilias.map((f) => (
                    <div key={f.id} className="miscel-familia-row">
                      <span className="miscel-familia-nombre">{f.familia}</span>
                      <span className="miscel-familia-monto">
                        ${Number(f.presupuesto).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        className="miscel-familia-remove"
                        onClick={() => setMiscelFamilias((prev) => prev.filter((x) => x.id !== f.id))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="miscel-subtotal">
                    Total misceláneos: <strong>${totalMiscel.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              )}
              <div className="miscel-add-row">
                <input
                  type="text"
                  placeholder="Familia (ej. MI)"
                  value={miscelInput.familia}
                  onChange={(e) => setMiscelInput((prev) => ({ ...prev, familia: e.target.value }))}
                  className="miscel-input-familia"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={miscelInput.presupuesto}
                  onChange={(e) => setMiscelInput((prev) => ({ ...prev, presupuesto: e.target.value }))}
                  className="miscel-input-monto"
                />
                <button
                  type="button"
                  className="action-button create-button miscel-btn-agregar"
                  onClick={() => {
                    const familia = miscelInput.familia.trim().toUpperCase();
                    const presupuesto = miscelInput.presupuesto.trim();
                    if (!familia || !presupuesto || Number(presupuesto) < 0) return;
                    setMiscelFamilias((prev) => [...prev, { id: Date.now(), familia, presupuesto }]);
                    setMiscelInput({ familia: "", presupuesto: "" });
                  }}
                >
                  Agregar
                </button>
              </div>
              <div className="presupuesto-total-preview">
                Total capturado: <strong>{formatCurrency(presupuestoTotalPreview)}</strong>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="action-button create-button">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {proyectoAEliminar && (
        <div className="confirm-overlay" onClick={cerrarConfirmacionEliminar}>
          <div className="confirm-card" onClick={(e) => e.stopPropagation()}>
            <h3>Eliminar proyecto</h3>
            <p>
              Se eliminará el proyecto <strong>{proyectoAEliminar.nombre}</strong> junto con todos sus pedidos y registros de
              cobranza.
            </p>
            <p>Para continuar, escribe el nombre del proyecto tal como aparece:</p>
            <input
              type="text"
              value={confirmacionProyecto}
              onChange={(e) => setConfirmacionProyecto(e.target.value)}
              placeholder={proyectoAEliminar.nombre}
              className="confirm-input"
              autoFocus
            />
            <small>
              Debes escribir: <strong>{proyectoAEliminar.nombre}</strong>
            </small>
            <div className="confirm-actions">
              <button type="button" className="cancel-button" onClick={cerrarConfirmacionEliminar} disabled={eliminandoProyecto}>
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={eliminarProyecto}
                disabled={eliminandoProyecto || !confirmacionCoincide}
              >
                {eliminandoProyecto ? "Eliminando..." : "Eliminar proyecto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
