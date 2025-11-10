import { useEffect, useRef, useState } from "react";
import type { ChangeEventHandler, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./mainPage.css";
import { authHeader, clearToken, getRole, getToken, isTokenValid } from "../auth";
import { parsePedidosCsv } from "../utils/pedidosCsv";
import type { PedidoCsv } from "../utils/pedidosCsv";

type Proyecto = {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string; // formato YYYY-MM-DD
};

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

export function MainPage() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [errorPedidos, setErrorPedidos] = useState<string>("");
  const [mensajePedidos, setMensajePedidos] = useState<string>("");
  const [mensajeGeneral, setMensajeGeneral] = useState<string>("");
  const [subiendoPedidos, setSubiendoPedidos] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [proyectoAEliminar, setProyectoAEliminar] = useState<Proyecto | null>(null);
  const [confirmacionProyecto, setConfirmacionProyecto] = useState<string>("");
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false);
  const pedidoFileInputRef = useRef<HTMLInputElement | null>(null);
  const role = (getRole() || "").toLowerCase();
  const isAdmin = role === "administrador";

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const cargarProyectos = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:3000/proyectos", {
        headers: { ...authHeader() },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProyectos(data.data as Proyecto[]);
      } else {
        setError(data?.message || "Error cargando proyectos");
      }
    } catch (e) {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTokenValid(getToken())) {
      navigate("/");
      return;
    }
    cargarProyectos();
  }, [navigate]);

  const abrirModal = () => setModalAbierto(true);
  const cerrarModal = () => {
    setModalAbierto(false);
    setNombre("");
    setFecha("");
    setError("");
  };

  const crearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !fecha) {
      setError("Completa nombre y fecha");
      return;
    }
    try {
      setError("");
      const res = await fetch("http://localhost:3000/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ nombre, fecha_proyecto: fecha }),
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        cerrarModal();
        cargarProyectos();
      } else {
        setError(data?.message || "No se pudo crear el proyecto");
      }
    } catch (e) {
      setError("Error de conexión con el servidor");
    }
  };

  const generarCobranzaTotal = async () => {
    try {
      setError("");
      const res = await fetch("http://localhost:3000/cobranza/export", { headers: { ...authHeader() } });
      if (!res.ok) { setError("No se pudo generar cobranza total"); return; }
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
    } catch (_) {
      setError("Error de conexion al generar cobranza total");
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
      const res = await fetch(`http://localhost:3000/proyectos/${proyectoAEliminar.id_proyecto}`, {
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

  useEffect(() => {
    if (!mensajePedidos) return;
    const timeout = setTimeout(() => setMensajePedidos(""), 2000);
    return () => clearTimeout(timeout);
  }, [mensajePedidos]);

  useEffect(() => {
    if (!errorPedidos) return;
    const timeout = setTimeout(() => setErrorPedidos(""), 2000);
    return () => clearTimeout(timeout);
  }, [errorPedidos]);

  useEffect(() => {
    if (!mensajeGeneral) return;
    const timeout = setTimeout(() => setMensajeGeneral(""), 2000);
    return () => clearTimeout(timeout);
  }, [mensajeGeneral]);

  const abrirCargaPedidos = () => {
    pedidoFileInputRef.current?.click();
  };

  const agruparPorProyecto = (pedidos: PedidoCsv[]) => {
    return pedidos.reduce<Record<string, PedidoCsv[]>>((acc, pedido) => {
      const key = (pedido.nombre_proyecto || "").trim();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(pedido);
      return acc;
    }, {});
  };

  const subirPedidosDesdeCsv: ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!proyectos.length) {
      setErrorPedidos("Primero carga la lista de proyectos antes de subir pedidos.");
      if (pedidoFileInputRef.current) pedidoFileInputRef.current.value = "";
      return;
    }
    setMensajePedidos("");
    setErrorPedidos("");
    setSubiendoPedidos(true);
    try {
      const exitos: string[] = [];
      const fallos: string[] = [];

      for (const file of files) {
        try {
          const text = await file.text();
          const parsed = parsePedidosCsv(text);
          if (!parsed.length) {
            fallos.push(`${file.name}: sin filas válidas`);
            continue;
          }
          const grupos = agruparPorProyecto(parsed);
          const nombres = Object.keys(grupos);
          if (!nombres.length) {
            fallos.push(`${file.name}: falta la columna PROYECTO`);
            continue;
          }
          const faltantes = nombres.filter((nombre) => {
            const normalized = nombre.trim().toLowerCase();
            return !proyectos.some((p) => p.nombre.trim().toLowerCase() === normalized);
          });
          if (faltantes.length) {
            fallos.push(`${file.name}: proyectos no encontrados (${faltantes.join(", ")})`);
            continue;
          }

          for (const nombre of nombres) {
            const normalized = nombre.trim().toLowerCase();
            const proyecto = proyectos.find((p) => p.nombre.trim().toLowerCase() === normalized);
            if (!proyecto) continue;
            const pedidosPorProyecto = grupos[nombre].map((pedido) => ({
              ...pedido,
              nombre_proyecto: proyecto.nombre,
            }));
            const res = await fetch(`http://localhost:3000/proyectos/${proyecto.id_proyecto}/pedidos`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader() },
              body: JSON.stringify({ pedidos: pedidosPorProyecto }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
              fallos.push(`${file.name} / ${proyecto.nombre}: ${data?.message || "Error al subir pedidos"}`);
            } else {
              const inserted = typeof data.inserted === "number" ? data.inserted : pedidosPorProyecto.length;
              exitos.push(`${proyecto.nombre}: ${inserted} pedidos cargados`);
            }
          }
        } catch {
          fallos.push(`${file.name}: no se pudo procesar`);
        }
      }

      if (exitos.length) {
        setMensajePedidos(exitos.join(" | "));
        await cargarProyectos();
      }
      if (fallos.length) {
        setErrorPedidos(fallos.join(" | "));
      } else if (exitos.length) {
        setErrorPedidos("");
      } else {
        setErrorPedidos("No se pudo procesar los archivos seleccionados");
      }
    } catch {
      setErrorPedidos("Error al procesar los archivos CSV");
    } finally {
      setSubiendoPedidos(false);
      if (pedidoFileInputRef.current) pedidoFileInputRef.current.value = "";
    }
  };

  return (
    <div className="main-page">
      <h1 className="titulo">Página Principal</h1>

      <div className="actions">
        {isAdmin && (
          <>
            <input
              ref={pedidoFileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              multiple
              onChange={subirPedidosDesdeCsv}
            />
            <button className="action-button create-button" onClick={abrirCargaPedidos} disabled={subiendoPedidos}>
              {subiendoPedidos ? "Subiendo pedidos..." : "Agregar pedidos"}
            </button>
          </>
        )}
        <button className="action-button create-button" onClick={abrirModal}>
          Crear proyecto
        </button>
        <button className="action-button create-button" onClick={generarCobranzaTotal}>
          Generar cobranza total
        </button>
        <button className="action-button logout-button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="contenido">
        {loading && <p>Cargando proyectos...</p>}
        {error && <p className="error-text">{error}</p>}
        {errorPedidos && <p className="error-text">{errorPedidos}</p>}
        {mensajePedidos && <p className="success-text">{mensajePedidos}</p>}
        {mensajeGeneral && <p className="success-text">{mensajeGeneral}</p>}
        {!loading && !error && (
          <ul className="lista-proyectos">
            {proyectos.map((p) => (
              <li
                key={p.id_proyecto}
                className="item-proyecto"
                onClick={() =>
                  navigate(`/proyecto/${p.id_proyecto}`, {
                    state: { nombre: p.nombre, fecha: p.fecha_proyecto },
                  })
                }
                style={{ cursor: "pointer" }}
              >
                <div className="proyecto-info">
                  <span className="nombre">{p.nombre}</span>
                  <span className="fecha">{p.fecha_proyecto}</span>
                </div>
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
              </li>
            ))}
            {proyectos.length === 0 && <li>No hay proyectos aún</li>}
          </ul>
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
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
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
              Se eliminará el proyecto <strong>{proyectoAEliminar.nombre}</strong> junto con todos sus pedidos y registros de cobranza.
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
            <small>Debes escribir: <strong>{proyectoAEliminar.nombre}</strong></small>
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
