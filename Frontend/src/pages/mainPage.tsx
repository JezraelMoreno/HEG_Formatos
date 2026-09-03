import { useEffect, useRef, useState } from "react";
import type { ChangeEventHandler, CSSProperties, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import "./mainPage.css";
import { AppShell } from "../components/AppShell";
import { Topbar } from "../components/Topbar";
import { useAuth } from "../hooks/useAuth";
import { authHeader, clearToken, getToken, isTokenValid } from "../auth";
import API_URL from "../config";
import { apiFetch } from "../api/client";
import { useActiveProject } from "../context/useActiveProject";
import type { Proyecto } from "../context/ProjectContextTypes";
import { calcularPresupuesto, deriveIniciales } from "../utils/proyectoDisplay";
import dashboardImg from "../../assets/dashboards.png";
import remisionesIMG from "../../assets/remisiones.png";
import pedidosImg from "../../assets/proyectos.png";
import contabilidadImg from "../../assets/contabilidad.png";
import viaticosImg from "../../assets/viaticos.png";

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
  const { proyectoActivo } = useActiveProject();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [error, setError] = useState<string>("");
  const [mensajeGeneral, setMensajeGeneral] = useState<string>("");
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
  const [resumenPedidos, setResumenPedidos] = useState<PedidoResumen[]>([]);
  const [usuariosPedidos, setUsuariosPedidos] = useState<string[]>([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState<string>("");
  const [fechaFiltroPedidos, setFechaFiltroPedidos] = useState<string>(() => getTodayISO());
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState("");
  const filtroFechaRef = useRef<HTMLInputElement | null>(null);
  const { isSuperadmin: isAdmin, isVisor, isSupervisor } = useAuth();
  const modulos: Array<{ key: ModuleKey; titulo: string; descripcion: string; imagen: string; accent: string; tint: string }> = [
    {
      key: "pedidos",
      titulo: "Módulo de Pedidos",
      descripcion: "Carga y consulta los pedidos asociados a cada proyecto.",
      imagen: pedidosImg,
      accent: "var(--color-accent)",
      tint: "var(--color-accent-light)",
    },
    {
      key: "contabilidad",
      titulo: "Módulo de Contabilidad",
      descripcion: "Crea proyectos, ajusta presupuestos y genera la cobranza.",
      imagen: contabilidadImg,
      accent: "var(--color-primary)",
      tint: "var(--color-primary-light)",
    },
    {
      key: "viaticos",
      titulo: "Módulo de Viáticos",
      descripcion: "Visualiza los proyectos para gestionar viáticos y gastos.",
      imagen: viaticosImg,
      accent: "var(--color-warning)",
      tint: "var(--color-warning-bg)",
    },
    {
      key: "dashboards",
      titulo: "Módulo de Dashboards",
      descripcion: "Visualiza métricas y análisis de proyectos, presupuestos y materiales.",
      imagen: dashboardImg,
      accent: "var(--color-success)",
      tint: "var(--color-success-bg)",
    },
    {
      key: "remisiones",
      titulo: "Control de Remisiones",
      descripcion: "Programa de entregas, control de existencias y seguimiento de recepciones.",
      imagen: remisionesIMG,
      accent: "var(--color-accent)",
      tint: "var(--color-accent-light)",
    },
  ];
  const presupuestoActivo = proyectoActivo ? calcularPresupuesto(proyectoActivo) : null;

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
    if (!proyectoActivo) return;
    if (key === "dashboards") {
      navigate(`/dashboards/${proyectoActivo.id_proyecto}/ejecutivo`);
      return;
    }
    if (key === "remisiones") {
      navigate(`/remisiones/${proyectoActivo.id_proyecto}`, { state: { nombreProyecto: proyectoActivo.nombre } });
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("moduloActual", key);
    }
    navigate(`/proyecto/${proyectoActivo.id_proyecto}`, {
      state: {
        modulo: key,
        nombre: proyectoActivo.nombre,
        fecha: proyectoActivo.fecha_proyecto,
        presupuesto_total: proyectoActivo.presupuesto_total,
        presupuesto_cristal: proyectoActivo.presupuesto_cristal,
        presupuesto_aluminio: proyectoActivo.presupuesto_aluminio,
        presupuesto_miscelaneos: proyectoActivo.presupuesto_miscelaneos,
        total_pedidos: proyectoActivo.total_pedidos,
      },
    });
  };

  const cargarProyectos = async () => {
    try {
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
    } catch {
      setError("Error de conexión con el servidor");
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


  if (!proyectoActivo) return null;

  const sidebarItems = modulos.map((modulo) => ({
    key: modulo.key,
    label: modulo.titulo.replace(/^(Módulo de |Control de )/, ""),
    active: false,
    onClick: () => seleccionarModulo(modulo.key),
  }));

  const metaPorModulo: Partial<Record<ModuleKey, string>> = {
    pedidos: presupuestoActivo ? `${formatCurrency(presupuestoActivo.gastado)} gastado` : undefined,
    contabilidad: presupuestoActivo ? `${presupuestoActivo.pctEjercido}% ejercido` : undefined,
  };

  return (
    <AppShell
      items={sidebarItems}
      activeProject={{ nombre: proyectoActivo.nombre, iniciales: deriveIniciales(proyectoActivo.nombre) }}
      onChangeProject={() => navigate("/proyectos")}
    >
      <Topbar title="Página principal">
          {isAdmin && (
            <button className="action-button secondary-button" onClick={() => navigate("/dashboards/proyectos")}>
              Portafolio
            </button>
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
          {error && <p className="error-text">{error}</p>}
          {mensajeGeneral && <p className="success-text">{mensajeGeneral}</p>}
        </div>

        <div className="encabezado">
          <div className="titulo-bloque">
            <nav className="breadcrumb-proyecto">
              <button type="button" onClick={() => navigate("/proyectos")}>Proyectos</button>
              <span> / </span>
              <span className="breadcrumb-actual">{proyectoActivo.nombre}</span>
            </nav>
            <h1 className="titulo">{proyectoActivo.nombre}</h1>
            <p className="subtitulo">Elige un módulo · todo lo que abras queda dentro de esta obra</p>
          </div>
          {presupuestoActivo && (
            <div className="encabezado-derecha mini-cards-proyecto">
              <div className="mini-card mini-card-disponible">
                <span className="mini-card-label">Disponible</span>
                <span className="mini-card-valor">{formatCurrency(presupuestoActivo.disponible)}</span>
              </div>
              <div className="mini-card mini-card-ejercido">
                <span className="mini-card-label">Ejercido</span>
                <span className="mini-card-valor">{presupuestoActivo.pctEjercido}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="paneles">
          <section className="panel panel-proyectos">
            <div className="module-selector">
              {modulos.map((modulo) => (
                <button
                  key={modulo.key}
                  className="module-card"
                  type="button"
                  onClick={() => seleccionarModulo(modulo.key)}
                  style={{ "--module-accent": modulo.accent, "--module-tint": modulo.tint } as CSSProperties}
                >
                  <div className="module-image">
                    <img src={modulo.imagen} alt={modulo.titulo} />
                  </div>
                  <div className="module-content">
                    <h3>{modulo.titulo}</h3>
                    <p>{modulo.descripcion}</p>
                  </div>
                  <div className="module-footer">
                    {metaPorModulo[modulo.key] && <span className="module-meta-text">{metaPorModulo[modulo.key]}</span>}
                    <span className="module-chip">Entrar →</span>
                  </div>
                </button>
              ))}
            </div>
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
