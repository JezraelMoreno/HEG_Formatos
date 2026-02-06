import { useEffect, useRef, useState } from "react";
import type { ChangeEventHandler, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./mainPage.css";
import { authHeader, clearToken, getRole, getToken, isTokenValid } from "../auth";
import { parsePedidosCsv } from "../utils/pedidosCsv";
import type { PedidoCsv } from "../utils/pedidosCsv";
import dashboardImg from "../../assets/dashboards.png"; 
import remisionesIMG from "../../assets/remisiones.png";
import pedidosImg from "../../assets/proyectos.png";
import contabilidadImg from "../../assets/contabilidad.png";
import viaticosImg from "../../assets/viaticos.png";

type Proyecto = {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string; // formato YYYY-MM-DD
  estado?: 'en_progreso' | 'completado';
  presupuesto?: number;
  presupuesto_total?: number;
  presupuesto_cristal?: number;
  presupuesto_aluminio?: number;
  presupuesto_miscelaneos?: number;
  total_pedidos?: number;
  presupuesto_disponible?: number;
};

type PedidoResumen = {
  id: number;
  nombre_proyecto: string;
  pedido: string;
  nombre_usuario: string;
  fecha_subida: string;
};

type DateInputWithPicker = HTMLInputElement & { showPicker?: () => void };

type ModuleKey = "pedidos" | "contabilidad" | "viaticos" | "dashboards" | "remisiones";

const getTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatCurrency = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

const CalendarIcon = () => (
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
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
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
  const [presupuestoCristal, setPresupuestoCristal] = useState("");
  const [presupuestoAluminio, setPresupuestoAluminio] = useState("");
  const [presupuestoMiscelaneos, setPresupuestoMiscelaneos] = useState("");
  const [proyectoAEliminar, setProyectoAEliminar] = useState<Proyecto | null>(null);
  const [confirmacionProyecto, setConfirmacionProyecto] = useState<string>("");
  const [eliminandoProyecto, setEliminandoProyecto] = useState(false);
  const [resumenPedidos, setResumenPedidos] = useState<PedidoResumen[]>([]);
  const [usuariosPedidos, setUsuariosPedidos] = useState<string[]>([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>("");
  const [fechaFiltroPedidos, setFechaFiltroPedidos] = useState<string>(() => getTodayISO());
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState("");
  const [busquedaProyecto, setBusquedaProyecto] = useState("");
  const [moduloSeleccionado, setModuloSeleccionado] = useState<ModuleKey | null>(null);
  const pedidoFileInputRef = useRef<HTMLInputElement | null>(null);
  const filtroFechaRef = useRef<HTMLInputElement | null>(null);
  const role = (getRole() || "").toLowerCase();
  const isAdmin = role === "administrador";
  const presupuestoTotalPreview = [presupuestoCristal, presupuestoAluminio, presupuestoMiscelaneos].reduce(
    (sum, val) => {
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 ? sum + num : sum;
    },
    0
  );
  const modulos: Array<{ key: ModuleKey; titulo: string; descripcion: string; imagen: string }> = [
    {
      key: "pedidos",
      titulo: "Módulo de Pedidos",
      descripcion: "Carga y consulta los pedidos asociados a cada proyecto.",
      imagen: pedidosImg,
    },
    {
      key: "contabilidad",
      titulo: "Módulo de Contabilidad",
      descripcion: "Crea proyectos, ajusta presupuestos y genera la cobranza.",
      imagen: contabilidadImg,
    },
    {
      key: "viaticos",
      titulo: "Módulo de Viáticos",
      descripcion: "Visualiza los proyectos para gestionar viáticos y gastos.",
      imagen: viaticosImg,
    },
    {
      key: "dashboards",
      titulo: "Módulo de Dashboards",
      descripcion: "Visualiza métricas y análisis de proyectos, presupuestos y materiales.",
      imagen: dashboardImg,
    },
    {
      key: "remisiones",
      titulo: "Control de Remisiones",
      descripcion: "Programa de entregas, control de existencias y seguimiento de recepciones.",
      imagen: remisionesIMG,
    },
  ];
  const moduloActivo = moduloSeleccionado ? modulos.find((m) => m.key === moduloSeleccionado) : null;
  const esModuloContabilidad = moduloSeleccionado === "contabilidad";
  const mostrarBuscador = Boolean(moduloSeleccionado) && moduloSeleccionado !== "dashboards" && moduloSeleccionado !== "remisiones";
  const mostrarProyectos = Boolean(moduloSeleccionado) && moduloSeleccionado !== "dashboards" && moduloSeleccionado !== "remisiones";

  const handleLogout = () => {
    clearToken();
    navigate("/");
  };

  const seleccionarModulo = (key: ModuleKey) => {
    if (key === "dashboards") {
      navigate("/dashboards");
      return;
    }
    if (key === "remisiones") {
      navigate("/remisiones");
      return;
    }
    setModuloSeleccionado(key);
    setBusquedaProyecto("");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("moduloActual", key);
    }
  };

  const volverAModulos = () => {
    setModuloSeleccionado(null);
    setBusquedaProyecto("");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("moduloActual");
    }
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
    setPresupuestoCristal("");
    setPresupuestoAluminio("");
    setPresupuestoMiscelaneos("");
    setError("");
  };

  const crearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    const parseBudgetInput = (value: string) => {
      if (value.trim() === "") return 0;
      const num = Number(value);
      return Number.isFinite(num) && num >= 0 ? Number(num.toFixed(2)) : NaN;
    };
    const cristalNum = parseBudgetInput(presupuestoCristal);
    const aluminioNum = parseBudgetInput(presupuestoAluminio);
    const miscelaneosNum = parseBudgetInput(presupuestoMiscelaneos);
    if (!nombre || !fecha || [cristalNum, aluminioNum, miscelaneosNum].some((n) => Number.isNaN(n))) {
      setError("Completa nombre, fecha y presupuestos válidos (usa 0 si no aplica)");
      return;
    }
    const presupuestoTotal = cristalNum + aluminioNum + miscelaneosNum;
    try {
      setError("");
      const res = await fetch("http://localhost:3000/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          nombre,
          fecha_proyecto: fecha,
          presupuesto_cristal: cristalNum,
          presupuesto_aluminio: aluminioNum,
          presupuesto_miscelaneos: miscelaneosNum,
          presupuesto_total: presupuestoTotal,
        }),
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

  const cambiarEstadoProyecto = async (idProyecto: number, nuevoEstado: 'en_progreso' | 'completado', event: MouseEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${idProyecto}/estado`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || "No se pudo actualizar el estado del proyecto");
        return;
      }
      setMensajeGeneral(`Estado del proyecto actualizado a: ${nuevoEstado === 'en_progreso' ? 'En Progreso' : 'Completado'}`);
      await cargarProyectos();
    } catch {
      setError("Error de conexión al cambiar estado del proyecto");
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setResumenPedidos([]);
      setUsuariosPedidos([]);
      setCargandoResumen(false);
      setErrorResumen("");
      return;
    }
    let activo = true;
    const cargarResumen = async () => {
      setCargandoResumen(true);
      setErrorResumen("");
      try {
        const params = new URLSearchParams();
        if (fechaFiltroPedidos) params.append("fecha", fechaFiltroPedidos);
        if (usuarioFiltro) params.append("usuario", usuarioFiltro);
        const qs = params.toString();
        const res = await fetch(`http://localhost:3000/pedidos/resumen${qs ? `?${qs}` : ""}`, {
          headers: { ...authHeader() },
        });
        const data = await res.json();
        if (!activo) return;
        if (res.ok && data?.success) {
          setResumenPedidos((data.data as PedidoResumen[]) || []);
          setUsuariosPedidos(Array.isArray(data.usuarios) ? data.usuarios.filter(Boolean) : []);
          if (data.fechaFiltro && typeof data.fechaFiltro === "string" && data.fechaFiltro !== fechaFiltroPedidos) {
            setFechaFiltroPedidos(data.fechaFiltro);
          }
        } else {
          setResumenPedidos([]);
          setErrorResumen(data?.message || "No se pudo cargar los pedidos del día");
        }
      } catch {
        if (!activo) return;
        setResumenPedidos([]);
        setErrorResumen("Error de conexión al cargar pedidos");
      } finally {
        if (activo) setCargandoResumen(false);
      }
    };
    cargarResumen();
    return () => {
      activo = false;
    };
  }, [isAdmin, fechaFiltroPedidos, usuarioFiltro]);

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

  const abrirCalendarioFiltro = () => {
    const input = filtroFechaRef.current as DateInputWithPicker | null;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
      input.click();
    }
  };

  const cambiarFechaFiltro: ChangeEventHandler<HTMLInputElement> = (e) => {
    const valor = e.target.value;
    if (!valor) {
      setFechaFiltroPedidos(getTodayISO());
      return;
    }
    setFechaFiltroPedidos(valor);
  };

  const filtroNormalizado = busquedaProyecto.trim().toLowerCase();
  const proyectosFiltrados = filtroNormalizado
    ? proyectos.filter((proyecto) => proyecto.nombre.toLowerCase().includes(filtroNormalizado))
    : proyectos;

  return (
    <div className="main-page">
      <div className="encabezado">
        <div className="titulo-bloque">
          <h1 className="titulo">{moduloActivo ? moduloActivo.titulo : "Pagina Principal"}</h1>
        </div>
        <div className="actions">
          {mostrarBuscador && (
            <div className="search-bar search-bar-inline">
              <label htmlFor="busqueda-proyecto" className="visually-hidden">
                Buscar proyecto
              </label>
              <input
                id="busqueda-proyecto"
                type="text"
                placeholder="Buscar proyecto"
                value={busquedaProyecto}
                onChange={(e) => setBusquedaProyecto(e.target.value)}
              />
            </div>
          )}
          {moduloSeleccionado && (
            <button className="action-button secondary-button" onClick={volverAModulos}>
              Cambiar módulo
            </button>
          )}

          {moduloSeleccionado === "pedidos" && isAdmin && (
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

          {esModuloContabilidad && (
            <>
              <button className="action-button create-button" onClick={abrirModal}>
                Crear proyecto
              </button>
              <button className="action-button create-button" onClick={generarCobranzaTotal}>
                Generar cobranza total
              </button>
            </>
          )}

          <button className="action-button logout-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="contenido">
        <div className="mensajes-globales">
          {loading && <p>Cargando proyectos...</p>}
          {error && <p className="error-text">{error}</p>}
          {errorPedidos && <p className="error-text">{errorPedidos}</p>}
          {mensajePedidos && <p className="success-text">{mensajePedidos}</p>}
          {mensajeGeneral && <p className="success-text">{mensajeGeneral}</p>}
        </div>

        <div className="paneles">
          <section className="panel panel-proyectos">
            {!mostrarProyectos && moduloSeleccionado !== "dashboards" && (
              <div className="module-selector">
                {modulos.map((modulo) => (
                  <button
                    key={modulo.key}
                    className="module-card"
                    type="button"
                    onClick={() => seleccionarModulo(modulo.key)}
                  >
                    <div className="module-image">
                      <img src={modulo.imagen} alt={modulo.titulo} />
                    </div>
                    <div className="module-content">
                      <span className="module-chip">Entrar</span>
                      <h3>{modulo.titulo}</h3>
                      <p>{modulo.descripcion}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {moduloSeleccionado === "dashboards" && (
              <div className="module-selector">
                <button
                  className="module-card"
                  type="button"
                  onClick={() => navigate("/dashboards/ejecutivo")}
                >
                  <div className="module-content">
                    <span className="module-chip">Ver</span>
                    <h3>Dashboard Ejecutivo</h3>
                    <p>Vista general del sistema de proyectos</p>
                  </div>
                </button>
                <button
                  className="module-card"
                  type="button"
                  onClick={() => navigate("/dashboards/presupuestos")}
                >
                  <div className="module-content">
                    <span className="module-chip">Ver</span>
                    <h3>Dashboard de Presupuestos</h3>
                    <p>Análisis financiero y control presupuestal</p>
                  </div>
                </button>
                <button
                  className="module-card"
                  type="button"
                  onClick={() => navigate("/dashboards/proyectos")}
                >
                  <div className="module-content">
                    <span className="module-chip">Ver</span>
                    <h3>Dashboard de Proyectos</h3>
                    <p>Seguimiento y control de proyectos</p>
                  </div>
                </button>
                <button
                  className="module-card"
                  type="button"
                  onClick={() => navigate("/dashboards/materiales")}
                >
                  <div className="module-content">
                    <span className="module-chip">Ver</span>
                    <h3>Dashboard de Materiales</h3>
                    <p>Gestión de inventario y proyección de compras</p>
                  </div>
                </button>
              </div>
            )}

            {mostrarProyectos && (
              <div className="proyectos-wrapper">
                {!loading && !error && (
                  <ul className="lista-proyectos">
                    {proyectosFiltrados.map((p) => {
                      const totalPedidos = p.total_pedidos ?? 0;
                      const sumaFamilias = (p.presupuesto_cristal ?? 0) + (p.presupuesto_aluminio ?? 0) + (p.presupuesto_miscelaneos ?? 0);
                      const presupuestoRestante = (p.presupuesto_total ?? 0) || sumaFamilias || (p.presupuesto ?? 0);
                      const presupuestoAsignado = presupuestoRestante + totalPedidos;
                      const claseDisponible = presupuestoRestante < 0 ? "presupuesto-disponible negativo" : "presupuesto-disponible positivo";
                      const presupuestoFamilias = {
                        cristal: p.presupuesto_cristal ?? 0,
                        aluminio: p.presupuesto_aluminio ?? 0,
                        miscelaneos: p.presupuesto_miscelaneos ?? 0,
                      };
                      return (
                        <li
                          key={p.id_proyecto}
                          className="item-proyecto"
                          onClick={() =>
                            navigate(`/proyecto/${p.id_proyecto}`, {
                          state: {
                            nombre: p.nombre,
                            fecha: p.fecha_proyecto,
                            presupuesto: presupuestoAsignado,
                            presupuesto_total: presupuestoRestante,
                            presupuesto_cristal: presupuestoFamilias.cristal,
                            presupuesto_aluminio: presupuestoFamilias.aluminio,
                            presupuesto_miscelaneos: presupuestoFamilias.miscelaneos,
                            total_pedidos: totalPedidos,
                            modulo: moduloSeleccionado || undefined,
                          },
                        })
                      }
                      style={{ cursor: "pointer" }}
                    >
                          <div className="proyecto-info">
                            <span className="nombre">{p.nombre}</span>
                            <span className="fecha">{p.fecha_proyecto}</span>
                            <div className="presupuesto-resumen">
                              <span>Asignado: {formatCurrency(presupuestoAsignado)}</span>
                              <span>Gastado: {formatCurrency(totalPedidos)}</span>
                              <span className={claseDisponible}>Disponible: {formatCurrency(presupuestoRestante)}</span>
                            </div>
                            <div className="presupuesto-familias">
                              <span className="presupuesto-chip">CR: <strong>{formatCurrency(presupuestoFamilias.cristal)}</strong></span>
                              <span className="presupuesto-chip">AL: <strong>{formatCurrency(presupuestoFamilias.aluminio)}</strong></span>
                              <span className="presupuesto-chip">MI: <strong>{formatCurrency(presupuestoFamilias.miscelaneos)}</strong></span>
                            </div>
                            {esModuloContabilidad && (
                              <div className="estado-selector">
                                <label htmlFor={`estado-${p.id_proyecto}`}>Estado:</label>
                                <select
                                  id={`estado-${p.id_proyecto}`}
                                  value={p.estado || 'en_progreso'}
                                  onChange={(e) => cambiarEstadoProyecto(p.id_proyecto, e.target.value as 'en_progreso' | 'completado', e as any)}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`estado-select ${p.estado === 'completado' ? 'completado' : 'en-progreso'}`}
                                >
                                  <option value="en_progreso">En Progreso</option>
                                  <option value="completado">Completado</option>
                                </select>
                              </div>
                            )}
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
                      );
                    })}
                    {proyectos.length === 0 && <li>No hay proyectos aún</li>}
                    {proyectos.length > 0 && proyectosFiltrados.length === 0 && <li>No se encontraron proyectos</li>}
                  </ul>
                )}
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="panel panel-resumen">
              <div className="panel-resumen-header">
                <h2>Pedidos ingresados</h2>
                <div className="resumen-filtros">
                  <div className="filtro campo-fecha">
                    <label htmlFor="filtro-fecha">Fecha</label>
                    <div className="calendar-field">
                      <input
                        id="filtro-fecha"
                        ref={filtroFechaRef}
                        type="date"
                        value={fechaFiltroPedidos}
                        onChange={cambiarFechaFiltro}
                      />
                      <button type="button" className="calendar-button" onClick={abrirCalendarioFiltro} aria-label="Seleccionar fecha">
                        <CalendarIcon />
                      </button>
                    </div>
                  </div>
                  <div className="filtro campo-usuario">
                    <label htmlFor="filtro-usuario">Usuario</label>
                    <select
                      id="filtro-usuario"
                      value={usuarioFiltro}
                      onChange={(e) => setUsuarioFiltro(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {usuariosPedidos.map((usuario) => (
                        <option key={usuario} value={usuario}>
                          {usuario}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="panel-resumen-body">
                {errorResumen ? (
                  <p className="error-text">{errorResumen}</p>
                ) : cargandoResumen ? (
                  <p>Cargando pedidos del día...</p>
                ) : resumenPedidos.length === 0 ? (
                  <p>No hay pedidos para la fecha seleccionada.</p>
                ) : (
                  <table className="tabla-resumen">
                    <thead>
                      <tr>
                        <th>Proyecto</th>
                        <th>Pedido</th>
                        <th>Ingresado por</th>
                        <th>Día de subida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenPedidos.map((pedido) => (
                        <tr key={pedido.id}>
                          <td>{pedido.nombre_proyecto || "Sin proyecto"}</td>
                          <td>{pedido.pedido}</td>
                          <td>{pedido.nombre_usuario || "Desconocido"}</td>
                          <td>{pedido.fecha_subida || "Sin fecha"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>
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
              <label>Presupuesto misceláneos</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={presupuestoMiscelaneos}
                onChange={(e) => setPresupuestoMiscelaneos(e.target.value)}
                placeholder="Presupuesto para misceláneos"
                required
              />
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
