import { useEffect, useRef, useState } from "react";
import type { ChangeEventHandler, FormEvent, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./mainPage.css";
import { AppShell } from "../components/AppShell";
import { Topbar } from "../components/Topbar";
import { useAuth } from "../hooks/useAuth";
import { authHeader, clearToken, getToken, isTokenValid } from "../auth";
import API_URL from "../config";
import { apiFetch } from "../api/client";
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

const ROLES_DISPONIBLES = ["Superadmin", "Aprobador", "Supervisor", "Ingeniero", "Contador", "Visor"];

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
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [mensajeGeneral, setMensajeGeneral] = useState<string>("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalUsuariosAbierto, setModalUsuariosAbierto] = useState(false);
  const [usuarios, setUsuarios] = useState<Array<{ id_usuario: number; nombre_usuario: string; tipo_usuario: string }>>([]);
  const [nuevoRolPorUsuario, setNuevoRolPorUsuario] = useState<Record<number, string>>({});
  const [guardandoRolId, setGuardandoRolId] = useState<number | null>(null);
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre_usuario: "", contrasena: "", confirmarContrasena: "", tipo_usuario: "contador" });
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [errorUsuario, setErrorUsuario] = useState("");
  const [mensajeUsuario, setMensajeUsuario] = useState("");
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [usuarioParaAsignar, setUsuarioParaAsignar] = useState<{ id_usuario: number; nombre_usuario: string } | null>(null);
  const [proyectosAsignadosIds, setProyectosAsignadosIds] = useState<Set<number>>(new Set());
  const [proyectosSeleccionadosIds, setProyectosSeleccionadosIds] = useState<Set<number>>(new Set());
  const [cargandoAsignacion, setCargandoAsignacion] = useState(false);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [errorAsignacion, setErrorAsignacion] = useState("");
  const [mensajeAsignacion, setMensajeAsignacion] = useState("");
  const [conteoPendientes, setConteoPendientes] = useState(0);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [presupuestoCristal, setPresupuestoCristal] = useState("");
  const [presupuestoAluminio, setPresupuestoAluminio] = useState("");
  const [miscelFamilias, setMiscelFamilias] = useState<Array<{ id: number; familia: string; presupuesto: string }>>([]);
  const [miscelInput, setMiscelInput] = useState({ familia: "", presupuesto: "" });
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
  const filtroFechaRef = useRef<HTMLInputElement | null>(null);
  const { isSuperadmin: isAdmin, isVisor, isSupervisor } = useAuth();
  const totalMiscel = miscelFamilias.reduce((sum, f) => {
    const n = Number(f.presupuesto);
    return Number.isFinite(n) && n >= 0 ? sum + n : sum;
  }, 0);
  const presupuestoTotalPreview = [presupuestoCristal, presupuestoAluminio].reduce(
    (sum, val) => {
      const num = Number(val);
      return Number.isFinite(num) && num >= 0 ? sum + num : sum;
    },
    totalMiscel
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

  const abrirModalUsuarios = async () => {
    setModalUsuariosAbierto(true);
    setErrorUsuario("");
    setMensajeUsuario("");
    setNuevoUsuario({ nombre_usuario: "", contrasena: "", confirmarContrasena: "", tipo_usuario: "contador" });
    setMostrarContrasena(false);
    setUsuarioParaAsignar(null);
    setProyectosAsignadosIds(new Set());
    setProyectosSeleccionadosIds(new Set());
    setErrorAsignacion("");
    setMensajeAsignacion("");
    try {
      const res = await fetch(`${API_URL}/usuarios`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok && data.success) setUsuarios(data.data);
    } catch {
      setErrorUsuario("No se pudieron cargar los usuarios.");
    }
  };

  const crearUsuario = async (e: FormEvent) => {
    e.preventDefault();
    setErrorUsuario("");
    setMensajeUsuario("");
    if (nuevoUsuario.contrasena !== nuevoUsuario.confirmarContrasena) {
      setErrorUsuario("Las contraseñas no coinciden.");
      return;
    }
    setGuardandoUsuario(true);
    try {
      const res = await fetch(`${API_URL}/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ nombre_usuario: nuevoUsuario.nombre_usuario, contrasena: nuevoUsuario.contrasena, tipo_usuario: nuevoUsuario.tipo_usuario }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMensajeUsuario("Usuario creado correctamente.");
        setNuevoUsuario({ nombre_usuario: "", contrasena: "", confirmarContrasena: "", tipo_usuario: "contador" });
        setMostrarContrasena(false);
        const res2 = await fetch(`${API_URL}/usuarios`, { headers: { ...authHeader() } });
        const data2 = await res2.json();
        if (res2.ok && data2.success) setUsuarios(data2.data);
      } else {
        setErrorUsuario(data.message || "Error al crear usuario.");
      }
    } catch {
      setErrorUsuario("Error de conexión.");
    } finally {
      setGuardandoUsuario(false);
    }
  };

  const cambiarRolUsuario = async (u: { id_usuario: number; nombre_usuario: string; tipo_usuario: string }) => {
    const nuevoRol = nuevoRolPorUsuario[u.id_usuario];
    if (!nuevoRol || nuevoRol === u.tipo_usuario) return;
    setErrorUsuario("");
    setMensajeUsuario("");
    setGuardandoRolId(u.id_usuario);
    try {
      await apiFetch(`/usuarios/${u.id_usuario}/rol`, {
        method: "PATCH",
        body: JSON.stringify({ rol: nuevoRol }),
      });
      setMensajeUsuario(`Rol de ${u.nombre_usuario} actualizado a ${nuevoRol}.`);
      setNuevoRolPorUsuario((prev) => {
        const next = { ...prev };
        delete next[u.id_usuario];
        return next;
      });
      const data = await apiFetch<Array<{ id_usuario: number; nombre_usuario: string; tipo_usuario: string }>>("/usuarios");
      setUsuarios(data);
    } catch (e) {
      setErrorUsuario(e instanceof Error ? e.message : "Error al actualizar el rol.");
    } finally {
      setGuardandoRolId(null);
    }
  };

  const abrirAsignacionObras = async (u: { id_usuario: number; nombre_usuario: string }) => {
    setUsuarioParaAsignar(u);
    setErrorAsignacion("");
    setMensajeAsignacion("");
    setCargandoAsignacion(true);
    try {
      const data = await apiFetch<Array<{ id_proyecto: number }>>(`/usuarios/${u.id_usuario}/proyectos-supervisados`);
      const ids = new Set((data || []).map((p) => p.id_proyecto));
      setProyectosAsignadosIds(ids);
      setProyectosSeleccionadosIds(new Set(ids));
    } catch (e) {
      setErrorAsignacion(e instanceof Error ? e.message : "No se pudieron cargar las obras asignadas.");
    } finally {
      setCargandoAsignacion(false);
    }
  };

  const toggleProyectoSeleccionado = (idProyecto: number) => {
    setProyectosSeleccionadosIds((prev) => {
      const next = new Set(prev);
      if (next.has(idProyecto)) next.delete(idProyecto);
      else next.add(idProyecto);
      return next;
    });
  };

  const volverATablaUsuarios = () => {
    setUsuarioParaAsignar(null);
    setProyectosAsignadosIds(new Set());
    setProyectosSeleccionadosIds(new Set());
    setErrorAsignacion("");
    setMensajeAsignacion("");
  };

  const guardarAsignacionObras = async () => {
    if (!usuarioParaAsignar) return;
    setErrorAsignacion("");
    setMensajeAsignacion("");
    setGuardandoAsignacion(true);
    const idUsuario = usuarioParaAsignar.id_usuario;
    const toAdd = [...proyectosSeleccionadosIds].filter((id) => !proyectosAsignadosIds.has(id));
    const toRemove = [...proyectosAsignadosIds].filter((id) => !proyectosSeleccionadosIds.has(id));
    try {
      await Promise.all([
        ...toAdd.map((idProyecto) =>
          apiFetch(`/proyectos/${idProyecto}/supervisores`, {
            method: "POST",
            body: JSON.stringify({ id_usuario: idUsuario }),
          })
        ),
        ...toRemove.map((idProyecto) =>
          apiFetch(`/proyectos/${idProyecto}/supervisores/${idUsuario}`, { method: "DELETE" })
        ),
      ]);
      setProyectosAsignadosIds(new Set(proyectosSeleccionadosIds));
      setMensajeAsignacion("Asignaciones guardadas correctamente.");
    } catch (e) {
      setErrorAsignacion(e instanceof Error ? e.message : "No se pudieron guardar las asignaciones.");
    } finally {
      setGuardandoAsignacion(false);
    }
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
      const res = await fetch(`${API_URL}/proyectos`, {
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
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    if (!isTokenValid(getToken())) {
      navigate("/");
      return;
    }
    cargarProyectos();
  }, [navigate]);

  useEffect(() => {
    if (!isAdmin && !isSupervisor) return;
    apiFetch<{ total: number }>("/pedidos/pendientes/conteo")
      .then((data) => setConteoPendientes(Number(data?.total) || 0))
      .catch(() => setConteoPendientes(0));
  }, [isAdmin, isSupervisor]);

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

  const crearProyecto = async (e: React.FormEvent) => {
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
          miscel_familias: miscelFamilias.map(f => ({
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
    } catch (e) {
      setError("Error de conexión con el servidor");
    }
  };

  const generarCobranzaTotal = async () => {
    try {
      setError("");
      const res = await fetch(`${API_URL}/cobranza/export`, { headers: { ...authHeader() } });
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

  const cambiarEstadoProyecto = async (idProyecto: number, nuevoEstado: 'en_progreso' | 'completado', event: MouseEvent<HTMLSelectElement>) => {
    event.stopPropagation();
    try {
      const res = await fetch(`${API_URL}/proyectos/${idProyecto}/estado`, {
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
        const res = await fetch(`${API_URL}/pedidos/resumen${qs ? `?${qs}` : ""}`, {
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
    if (!mensajeGeneral) return;
    const timeout = setTimeout(() => setMensajeGeneral(""), 2000);
    return () => clearTimeout(timeout);
  }, [mensajeGeneral]);

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

  const sidebarItems = modulos.map((modulo) => ({
    key: modulo.key,
    label: modulo.titulo.replace(/^(Módulo de |Control de )/, ""),
    active: moduloSeleccionado === modulo.key,
    onClick: () => seleccionarModulo(modulo.key),
  }));

  return (
    <AppShell items={sidebarItems}>
      <Topbar
        title={moduloActivo ? moduloActivo.titulo : "Página principal"}
        onBack={moduloSeleccionado ? volverAModulos : undefined}
      >
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

          {(isAdmin || isVisor) && (
            <button className="action-button secondary-button" onClick={abrirModalUsuarios}>
              Usuarios
            </button>
          )}

          {(isAdmin || isSupervisor) && conteoPendientes > 0 && (
            <span className="badge-pendientes" title="Pedidos en estado Levantado sin resolver">
              {conteoPendientes} pendiente{conteoPendientes === 1 ? "" : "s"}
            </span>
          )}

          <button
            className="action-button secondary-button"
            onClick={() => setDarkMode(prev => !prev)}
            title={darkMode ? "Modo claro" : "Modo oscuro"}
          >
            {darkMode ? "Claro" : "Oscuro"}
          </button>

          <button className="action-button logout-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
      </Topbar>

      <div className="app-shell-content">

      <div className="contenido">
        <div className="mensajes-globales">
          {loading && <p>Cargando proyectos...</p>}
          {error && <p className="error-text">{error}</p>}
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
                      const presupuestoAsignado = (p.presupuesto_total ?? 0) || sumaFamilias || (p.presupuesto ?? 0);
                      const presupuestoRestante = presupuestoAsignado - totalPedidos;
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

          {(isAdmin || isVisor) && (
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
                    setMiscelFamilias((prev) => [
                      ...prev,
                      { id: Date.now(), familia, presupuesto },
                    ]);
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

      {modalUsuariosAbierto && (
        <div className="modal-overlay" onClick={() => setModalUsuariosAbierto(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <h3>Gestionar usuarios</h3>

            {!usuarioParaAsignar && (
            <>
            {isAdmin && (<form onSubmit={crearUsuario} className="form-proyecto">
              <label>Nombre de usuario</label>
              <input
                type="text"
                value={nuevoUsuario.nombre_usuario}
                onChange={(e) => setNuevoUsuario((u) => ({ ...u, nombre_usuario: e.target.value }))}
                placeholder="Nombre de usuario"
                required
                maxLength={15}
              />
              <label>Contraseña</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type={mostrarContrasena ? "text" : "password"}
                  value={nuevoUsuario.contrasena}
                  onChange={(e) => setNuevoUsuario((u) => ({ ...u, contrasena: e.target.value }))}
                  placeholder="Contraseña"
                  required
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="action-button secondary-button"
                  style={{ whiteSpace: "nowrap", padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                  onClick={() => setMostrarContrasena((v) => !v)}
                >
                  {mostrarContrasena ? "Ocultar" : "Ver"}
                </button>
              </div>
              <label>Confirmar contraseña</label>
              <input
                type={mostrarContrasena ? "text" : "password"}
                value={nuevoUsuario.confirmarContrasena}
                onChange={(e) => setNuevoUsuario((u) => ({ ...u, confirmarContrasena: e.target.value }))}
                placeholder="Repetir contraseña"
                required
              />
              <label>Tipo</label>
              <select
                value={nuevoUsuario.tipo_usuario}
                onChange={(e) => setNuevoUsuario((u) => ({ ...u, tipo_usuario: e.target.value }))}
              >
                <option value="contador">Contador</option>
                <option value="administrador">Administrador</option>
                <option value="visor">Visor</option>
              </select>
              {errorUsuario && <p className="error-text">{errorUsuario}</p>}
              {mensajeUsuario && <p style={{ color: "green" }}>{mensajeUsuario}</p>}
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={() => setModalUsuariosAbierto(false)}>
                  Cerrar
                </button>
                <button type="submit" className="action-button create-button" disabled={guardandoUsuario}>
                  {guardandoUsuario ? "Guardando..." : "Agregar usuario"}
                </button>
              </div>
            </form>)}

            {!isAdmin && (errorUsuario || mensajeUsuario) && (
              <>
                {errorUsuario && <p className="error-text">{errorUsuario}</p>}
                {mensajeUsuario && <p style={{ color: "green" }}>{mensajeUsuario}</p>}
              </>
            )}

            {!isAdmin && (
              <div className="modal-actions" style={{ marginTop: "0.5rem" }}>
                <button type="button" className="cancel-button" onClick={() => setModalUsuariosAbierto(false)}>
                  Cerrar
                </button>
              </div>
            )}

            {usuarios.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <h4 style={{ marginBottom: "0.5rem" }}>Usuarios registrados</h4>
                <table className="tabla-resumen">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Tipo</th>
                      {isAdmin && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u) => (
                      <tr key={u.id_usuario}>
                        <td>{u.nombre_usuario}</td>
                        <td>
                          {isAdmin ? (
                            <select
                              value={nuevoRolPorUsuario[u.id_usuario] ?? u.tipo_usuario}
                              onChange={(e) =>
                                setNuevoRolPorUsuario((prev) => ({ ...prev, [u.id_usuario]: e.target.value }))
                              }
                              style={{ padding: "0.25rem 0.4rem", fontSize: "0.85rem" }}
                            >
                              {ROLES_DISPONIBLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          ) : (
                            u.tipo_usuario
                          )}
                        </td>
                        {isAdmin && (
                          <td>
                            {u.tipo_usuario === "Supervisor" && (
                              <button
                                type="button"
                                className="action-button secondary-button"
                                style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
                                onClick={() => abrirAsignacionObras(u)}
                              >
                                Asignar obras
                              </button>
                            )}
                            {(nuevoRolPorUsuario[u.id_usuario] ?? u.tipo_usuario) !== u.tipo_usuario && (
                              <button
                                type="button"
                                className="action-button create-button"
                                style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem", marginLeft: "0.4rem" }}
                                disabled={guardandoRolId === u.id_usuario}
                                onClick={() => cambiarRolUsuario(u)}
                              >
                                {guardandoRolId === u.id_usuario ? "Guardando..." : "Guardar rol"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>
            )}

            {usuarioParaAsignar && (
              <div>
                <h4 style={{ marginBottom: "0.5rem" }}>Obras asignadas — {usuarioParaAsignar.nombre_usuario}</h4>
                {cargandoAsignacion ? (
                  <p>Cargando...</p>
                ) : (
                  <ul className="checklist-proyectos">
                    {proyectos.map((p) => (
                      <li key={p.id_proyecto} className={p.estado === "completado" ? "proyecto-inactivo" : ""}>
                        <label>
                          <input
                            type="checkbox"
                            checked={proyectosSeleccionadosIds.has(p.id_proyecto)}
                            onChange={() => toggleProyectoSeleccionado(p.id_proyecto)}
                          />
                          {" "}
                          {p.nombre} {p.estado === "completado" && <span>(completado)</span>}
                        </label>
                      </li>
                    ))}
                    {proyectos.length === 0 && <li>No hay proyectos aún</li>}
                  </ul>
                )}
                {errorAsignacion && <p className="error-text">{errorAsignacion}</p>}
                {mensajeAsignacion && <p style={{ color: "green" }}>{mensajeAsignacion}</p>}
                <div className="modal-actions">
                  <button type="button" className="cancel-button" onClick={volverATablaUsuarios}>
                    Volver
                  </button>
                  <button
                    type="button"
                    className="action-button create-button"
                    disabled={guardandoAsignacion || cargandoAsignacion}
                    onClick={guardarAsignacionObras}
                  >
                    {guardandoAsignacion ? "Guardando..." : "Guardar asignaciones"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
