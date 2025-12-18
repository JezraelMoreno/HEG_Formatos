import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { authHeader, getToken, isTokenValid, getRole } from "../auth";
import { parsePedidosCsv } from "../utils/pedidosCsv";
import type { PedidoCsv } from "../utils/pedidosCsv";

import "./proyectoDetalle.css";

type Pedido = {
  id: number;
  id_proyecto: number;
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  nombre_usuario?: string | null;
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string | null;
  importe: number;
  porcentaje_descuento?: number | null;
};

type PedidoDetalleItem = {
  id_detalle: number;
  descripcion: string;
  unidad?: string | null;
  medida?: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  clave?: string | null;
  ml?: number | null;
  acabado?: string | null;
  kg?: number | null;
  precio_x_kg?: number | null;
};

type PedidoDetalleCristalItem = {
  id_detalle: number;
  descripcion: string;
  clave_modelo?: string | null;
  ancho?: number | null;
  largo?: number | null;
  m2_corte?: number | null;
  piezas: number;
  m2_pedido?: number | null;
  precio_unitario: number;
  importe: number;
};

type PedidoDetalleAluminioItem = {
  id_detalle: number;
  descripcion: string;
  numero_perfil?: string | null;
  medida_tramo?: number | null;
  unidad?: string | null;
  peso_kg_ml?: number | null;
  perimetro_m2_ml?: number | null;
  acabado?: string | null;
  total_tramos?: number | null;
  ml?: number | null;
  kg?: number | null;
  m2?: number | null;
  importe: number;
};

type Cobranza = {
  id_cobranza: number;
  id_proyecto: number;
  contratado_a_fecha: number;
  mano_obra: number;
  cobrado_total: number;
  por_cobrar_total: number;
  fondo_garantia: number;
  liquido_por_cobrar: number;
  numero: number;
  fecha?: string | null;
  numero_factura?: string | null;
  concepto?: string | null;
  importe_a_cobrar: number;
  importe_cobrado: number;
  saldo_por_cobrar: number;
  fecha_pago?: string | null;
  periodo?: string | null;
  fecha_reporte: string;
};

type MultiSelectFilterProps = {
  label: string;
  placeholder: string;
  items: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

type ProyectoInfo = {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string;
  presupuesto?: number;
  presupuesto_total?: number;
  presupuesto_cristal?: number;
  presupuesto_aluminio?: number;
  presupuesto_miscelaneos?: number;
  total_pedidos?: number;
  presupuesto_disponible?: number;
};

type ProyectoLocationState = {
  nombre?: string;
  fecha?: string;
  presupuesto?: number;
  presupuesto_total?: number;
  presupuesto_cristal?: number;
  presupuesto_aluminio?: number;
  presupuesto_miscelaneos?: number;
  total_pedidos?: number;
  presupuesto_disponible?: number;
  modulo?: string | null;
};

type PresupuestoHistorial = {
  id_historial: number;
  fecha_presupuesto: string;
  presupuesto_cristal: number;
  presupuesto_aluminio: number;
  presupuesto_miscelaneos: number;
  presupuesto_total: number;
};

type ExplosionRow = {
  id: number;
  clan: string;
  familia: string;
  presupuesto_asignado: number;
  presupuesto_restante: number;
  gastado: number;
};

type PresupuestoViatico = {
  id_presupuesto: number;
  familia: string;
  presupuesto_asignado: number;
  gastado: number;
  restante: number;
};

type MovimientoViatico = {
  id_movimiento: number;
  familia: string;
  persona: string;
  concepto: string;
  clave_referencia?: string | null;
  fecha: string;
  ingreso: number;
  egreso: number;
  saldo: number;
  nombre_usuario: string;
};

const getTodayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatCurrency = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const parseMontoPositivo = (value: string) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return NaN;
  return Number(num.toFixed(2));
};

function MultiSelectFilter({
  label,
  placeholder,
  items,
  selected,
  onChange,
  disabled,
}: MultiSelectFilterProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const opciones = useMemo(() => {
    const conjunto = new Set(items);
    selected.forEach((valor) => conjunto.add(valor));
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b));
  }, [items, selected]);

  const resumen = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.slice(0, 2).join(", ")}${selected.length > 2 ? ` +${selected.length - 2}` : ""}`;

  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!abierto) return;
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) {
        cerrar();
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (!abierto) return;
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar();
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [abierto, cerrar]);

  const alternar = () => {
    if (disabled) return;
    setAbierto((prev) => !prev);
  };

  const toggleSeleccion = (valor: string) => {
    const yaSeleccionado = selected.includes(valor);
    const siguiente = yaSeleccionado
      ? selected.filter((v) => v !== valor)
      : [...selected, valor];
    onChange(siguiente);
  };

  return (
    <div className={`multi-filter${abierto ? " abierto" : ""}`} ref={contenedorRef}>
      <button
        type="button"
        className="filter-select multi-trigger"
        onClick={alternar}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span className="multi-trigger-label">{label}</span>
        <span className="multi-trigger-value">{resumen}</span>
        <span className="multi-trigger-icon" aria-hidden="true">v</span>
      </button>
      {abierto && (
        <div className="multi-panel" role="listbox" aria-multiselectable="true">
          {opciones.length === 0 ? (
            <div className="multi-empty">No hay opciones disponibles</div>
          ) : (
            <ul className="multi-options">
              {opciones.map((valor) => (
                <li key={valor}>
                  <label className="multi-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(valor)}
                      onChange={() => toggleSeleccion(valor)}
                    />
                    <span>{valor}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="btn btn-secondary multi-close" onClick={cerrar}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

export function ProyectoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation() as { state?: ProyectoLocationState };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [proyectoInfo, setProyectoInfo] = useState<ProyectoInfo | null>(() => {
    if (!state) return null;
    const presupuestoTotalEstado = state.presupuesto_total ?? state.presupuesto ?? 0;
    return {
      id_proyecto: Number(id) || 0,
      nombre: state.nombre || "Proyecto",
      fecha_proyecto: state.fecha || "",
      presupuesto: presupuestoTotalEstado,
      presupuesto_total: presupuestoTotalEstado,
      presupuesto_cristal: state.presupuesto_cristal,
      presupuesto_aluminio: state.presupuesto_aluminio,
      presupuesto_miscelaneos: state.presupuesto_miscelaneos,
      total_pedidos: state.total_pedidos,
      presupuesto_disponible: state.presupuesto_disponible ?? presupuestoTotalEstado,
    };
  });
  const [cargandoProyecto, setCargandoProyecto] = useState(false);

  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ordenPedidos, setOrdenPedidos] = useState<"desc" | "asc">("desc");
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [detallesPedido, setDetallesPedido] = useState<PedidoDetalleItem[]>([]);
  const [detallesCristal, setDetallesCristal] = useState<PedidoDetalleCristalItem[]>([]);
  const [detallesAluminio, setDetallesAluminio] = useState<PedidoDetalleAluminioItem[]>([]);
  const [tipoDetallePedido, setTipoDetallePedido] = useState<"miscelaneos" | "cristal" | "aluminio">("miscelaneos");
  const [cargandoDetalles, setCargandoDetalles] = useState(false);
  const [detalleError, setDetalleError] = useState("");
  const [historialPresupuesto, setHistorialPresupuesto] = useState<PresupuestoHistorial[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [modalPresupuestoAbierto, setModalPresupuestoAbierto] = useState(false);
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);
  const [formPresupuesto, setFormPresupuesto] = useState({
    cristal: "",
    aluminio: "",
    miscelaneos: "",
    fecha: getTodayISO(),
  });
  const totalDetalles = useMemo(() => {
    if (tipoDetallePedido === "cristal") {
      return detallesCristal.reduce((sum, det) => sum + Number(det.importe || 0), 0);
    }
    if (tipoDetallePedido === "aluminio") {
      return detallesAluminio.reduce((sum, det) => sum + Number(det.importe || 0), 0);
    }
    return detallesPedido.reduce((sum, det) => sum + Number(det.importe || 0), 0);
  }, [detallesAluminio, detallesCristal, detallesPedido, tipoDetallePedido]);
  const porcentajeDescuento = useMemo(() => {
    if (!pedidoSeleccionado) return 0;
    let pct = Number(pedidoSeleccionado.porcentaje_descuento ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    if (pct > 0 && pct <= 1) pct = pct * 100;
    return pct;
  }, [pedidoSeleccionado]);
  const subtotalBase = totalDetalles || 0;
  const descuentoMonto = useMemo(
    () => subtotalBase * (porcentajeDescuento / 100),
    [subtotalBase, porcentajeDescuento]
  );
  const subtotalConDescuento = useMemo(
    () => subtotalBase - descuentoMonto,
    [subtotalBase, descuentoMonto]
  );
  const ivaMonto = useMemo(
    () => subtotalConDescuento * 0.16,
    [subtotalConDescuento]
  );
  const totalFinal = useMemo(
    () => subtotalConDescuento + ivaMonto,
    [subtotalConDescuento, ivaMonto]
  );
  const totalPedidosProyecto = proyectoInfo?.total_pedidos ?? state?.total_pedidos ?? 0;
  const presupuestoRestanteTotal =
    proyectoInfo?.presupuesto_total ??
    proyectoInfo?.presupuesto ??
    state?.presupuesto_total ??
    state?.presupuesto ??
    0;
  const presupuestoAsignado = presupuestoRestanteTotal + totalPedidosProyecto;
  const clasePresupuestoDisponible = presupuestoRestanteTotal < 0 ? "monto-negativo" : "monto-positivo";
  const presupuestoCristal = proyectoInfo?.presupuesto_cristal ?? state?.presupuesto_cristal ?? 0;
  const presupuestoAluminio = proyectoInfo?.presupuesto_aluminio ?? state?.presupuesto_aluminio ?? 0;
  const presupuestoMiscelaneos = proyectoInfo?.presupuesto_miscelaneos ?? state?.presupuesto_miscelaneos ?? 0;
  const clasePresupuestoCristal = presupuestoCristal < 0 ? "monto-negativo" : "monto-positivo";
  const clasePresupuestoAluminio = presupuestoAluminio < 0 ? "monto-negativo" : "monto-positivo";
  const clasePresupuestoMiscelaneos = presupuestoMiscelaneos < 0 ? "monto-negativo" : "monto-positivo";
  const pedidosOrdenados = useMemo(() => {
    const toTime = (valor: string) => {
      const time = Date.parse(valor);
      return Number.isNaN(time) ? 0 : time;
    };
    const copia = [...pedidos];
    copia.sort((a, b) => {
      const diff = toTime(b.fecha_aprobacion) - toTime(a.fecha_aprobacion);
      return ordenPedidos === "desc" ? diff : -diff;
    });
    return copia;
  }, [ordenPedidos, pedidos]);

  // filtros
  const [familiasSeleccionadas, setFamiliasSeleccionadas] = useState<string[]>([]);
  const [familias, setFamilias] = useState<string[]>([]);
  const [clanesSeleccionados, setClanesSeleccionados] = useState<string[]>([]);
  const [clanes, setClanes] = useState<string[]>([]);
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [concepto, setConcepto] = useState<string>("");
  const [conceptos, setConceptos] = useState<string[]>([]);
  const [fecha, setFecha] = useState<string>("");

  const [explosionInsumos, setExplosionInsumos] = useState<ExplosionRow[]>([]);
  const [cargandoExplosion, setCargandoExplosion] = useState(false);
  const [guardandoExplosion, setGuardandoExplosion] = useState(false);
  const [errorExplosion, setErrorExplosion] = useState<string>("");
  const [formExplosion, setFormExplosion] = useState({ clan: "", familia: "", presupuesto: "" });
  const [editandoExplosionId, setEditandoExplosionId] = useState<number | null>(null);
  const [presupuestoMiscelBase, setPresupuestoMiscelBase] = useState<number>(0);
  const [presupuestoMiscelDisponible, setPresupuestoMiscelDisponible] = useState<number>(0);

  const moduloOrigen = useMemo(() => {
    const fromState = (state as ProyectoLocationState | null)?.modulo;
    if (fromState) return fromState.toLowerCase();
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("moduloActual");
      return stored ? stored.toLowerCase() : "";
    }
    return "";
  }, [state]);
  const mostrarHistorialPresupuesto = moduloOrigen === "contabilidad";
  const mostrarPedidosModulo = moduloOrigen === "pedidos";
  const mostrarCobranza = moduloOrigen === "contabilidad";
  const nombreProyecto = proyectoInfo?.nombre || state?.nombre || "Proyecto";
  const role = (getRole() || '').toLowerCase();
  const isAdmin = role === 'administrador';
  const mostrarViaticos = moduloOrigen === "viaticos";

  // viáticos
  const [presupuestosViaticos, setPresupuestosViaticos] = useState<PresupuestoViatico[]>([]);
  const [movimientosViaticos, setMovimientosViaticos] = useState<MovimientoViatico[]>([]);
  const [cargandoPresupuestos, setCargandoPresupuestos] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [errorPresupuestos, setErrorPresupuestos] = useState("");
  const [errorMovimientos, setErrorMovimientos] = useState("");
  const [familiaFiltro, setFamiliaFiltro] = useState("");
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState("");
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState("");
  const [vistaViaticosActiva, setVistaViaticosActiva] = useState<"movimientos" | "presupuestos">("movimientos");
  const [modalMovimientoViatico, setModalMovimientoViatico] = useState(false);
  const [modalPresupuestoViatico, setModalPresupuestoViatico] = useState(false);

  // cobranza
  const [cargandoCobranza, setCargandoCobranza] = useState(false);
  const [cobranzas, setCobranzas] = useState<Cobranza[]>([]);
  const [formCobranzaAbierto, setFormCobranzaAbierto] = useState(false);
  const hoyISO = new Date();
  const hoyStr = `${hoyISO.getFullYear()}-${String(hoyISO.getMonth()+1).padStart(2,'0')}-${String(hoyISO.getDate()).padStart(2,'0')}`;
  const [contratadoFecha, setContratadoFecha] = useState<string>("");
  const [manoObra, setManoObra] = useState<string>("");
  const [cobradoTotal, setCobradoTotal] = useState<string>("");
  const [porCobrarTotal, setPorCobrarTotal] = useState<string>("");
  const [fondoGarantia, setFondoGarantia] = useState<string>("");
  const [liquidoPorCobrar, setLiquidoPorCobrar] = useState<string>("");
  const [numeroRegistro, setNumeroRegistro] = useState<string>("");
  const [fechaDetalle, setFechaDetalle] = useState<string>("");
  const [numeroFactura, setNumeroFactura] = useState<string>("");
  const [conceptoCobranza, setConceptoCobranza] = useState<string>("");
  const [importeACobrar, setImporteACobrar] = useState<string>("");
  const [importeCobrado, setImporteCobrado] = useState<string>("");
  const [saldoPorCobrar, setSaldoPorCobrar] = useState<string>("");
  const [fechaPago, setFechaPago] = useState<string>("");
  const [periodoRegistro, setPeriodoRegistro] = useState<string>("");
  const [fechaReporte, setFechaReporte] = useState<string>(hoyStr);

  const abrirExplorador = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const parseCsv = useCallback(
    (text: string) => parsePedidosCsv(text, nombreProyecto),
    [nombreProyecto]
  );

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !id) return;
    setMensaje("");
    setError("");
    setSubiendo(true);
    try {
      const allParsed: PedidoCsv[] = [];
      for (const f of files) {
        try {
          const text = await f.text();
          const parsed = parseCsv(text);
          if (parsed.length) allParsed.push(...parsed);
        } catch (_) {
          // ignorar archivos que no se puedan leer
        }
      }
      if (!allParsed.length) { setError("CSV(s) sin filas válidas"); return; }
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ pedidos: allParsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Error al subir pedidos");
      } else {
        setMensaje(data?.message || "Pedidos cargados correctamente");
        await cargarPedidos();
        await cargarProyecto();
        await cargarExplosion();
      }
    } catch (_) {
      setError("No se pudo procesar los archivos CSV");
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const volver = useCallback(() => navigate("/home"), [navigate]);

  const cargarPedidos = useCallback(async (overrides?: {
    familias?: string[];
    clanes?: string[];
    proveedores?: string[];
    concepto?: string;
    fecha?: string;
  }) => {
    if (!id) return;
    setCargandoPedidos(true);
    try {
      const familiasFiltro = overrides?.familias ?? familiasSeleccionadas;
      const clanesFiltro = overrides?.clanes ?? clanesSeleccionados;
      const proveedoresFiltro = overrides?.proveedores ?? proveedoresSeleccionados;
      const conceptoFiltro = overrides?.concepto ?? concepto;
      const fechaFiltro = overrides?.fecha ?? fecha;
      const params: string[] = [];
      const agregarLista = (nombre: string, valores: string[]) => {
        if (valores.length) {
          params.push(`${nombre}=${encodeURIComponent(valores.join(","))}`);
        }
      };
      agregarLista("familia", familiasFiltro);
      agregarLista("clan", clanesFiltro);
      agregarLista("proveedor", proveedoresFiltro);
      if (conceptoFiltro) params.push(`concepto=${encodeURIComponent(conceptoFiltro)}`);
      if (fechaFiltro) params.push(`fecha=${encodeURIComponent(fechaFiltro)}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos${qs}`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok && data?.success) {
        setPedidos(data.data as Pedido[]);
      } else {
        setError(data?.message || "Error cargando pedidos");
      }
    } catch (_) {
      setError("Error de conexion al cargar pedidos");
    } finally {
      setCargandoPedidos(false);
    }
  }, [id, familiasSeleccionadas, clanesSeleccionados, proveedoresSeleccionados, concepto, fecha]);

  const cargarCobranza = useCallback(async () => {
    if (!id) return;
    setCargandoCobranza(true);
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/cobranza`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok && data?.success) {
        setCobranzas(data.data as Cobranza[]);
      } else {
        setError(data?.message || "Error cargando cobranza");
      }
    } catch (_) {
      setError("Error de conexion al cargar cobranza");
    } finally {
      setCargandoCobranza(false);
    }
  }, [id]);
  const cargarProyecto = useCallback(async () => {
    if (!id) return;
    setCargandoProyecto(true);
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}`, { headers: { ...authHeader() } });
      const data = await res.json();
      if (res.ok && data?.success) {
        const info = data.data as ProyectoInfo;
        const presupuestoTotalResp = info.presupuesto_total ?? info.presupuesto ?? 0;
        setProyectoInfo({
          ...info,
          presupuesto: presupuestoTotalResp,
          presupuesto_total: presupuestoTotalResp,
          presupuesto_disponible: info.presupuesto_disponible ?? presupuestoTotalResp,
        });
      } else {
        setError(data?.message || "Error cargando proyecto");
      }
    } catch (_) {
      setError("Error de conexion al cargar proyecto");
    } finally {
      setCargandoProyecto(false);
    }
  }, [id]);

  const cargarHistorialPresupuesto = useCallback(async () => {
    if (!id) return;
    setCargandoHistorial(true);
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/presupuestos/historial`, {
        headers: { ...authHeader() },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setHistorialPresupuesto((data.data as PresupuestoHistorial[]) || []);
      } else {
        setHistorialPresupuesto([]);
      }
    } catch {
      setHistorialPresupuesto([]);
    } finally {
      setCargandoHistorial(false);
    }
  }, [id]);

  const limpiarFormularioExplosion = () => {
    setFormExplosion({ clan: "", familia: "", presupuesto: "" });
    setEditandoExplosionId(null);
  };

  const seleccionarExplosion = (row: ExplosionRow) => {
    setEditandoExplosionId(row.id);
    setFormExplosion({
      clan: row.clan || "",
      familia: row.familia || "",
      presupuesto: String(row.presupuesto_asignado ?? 0),
    });
  };

  const guardarExplosion = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const monto = parseMontoPositivo(formExplosion.presupuesto);
    if (Number.isNaN(monto)) {
      setErrorExplosion("Ingresa un monto válido (0 o mayor)");
      return;
    }
    if (!formExplosion.familia.trim()) {
      setErrorExplosion("La familia es obligatoria");
      return;
    }
    setGuardandoExplosion(true);
    setErrorExplosion("");
    try {
      const payload = {
        clan: formExplosion.clan.trim().toUpperCase(),
        familia: formExplosion.familia.trim().toUpperCase(),
        presupuesto_asignado: monto,
      };
      const url = editandoExplosionId
        ? `http://localhost:3000/proyectos/${id}/explosion-insumos/${editandoExplosionId}`
        : `http://localhost:3000/proyectos/${id}/explosion-insumos`;
      const method = editandoExplosionId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setErrorExplosion(data?.message || "No se pudo guardar la asignación");
        return;
      }
      setMensaje(editandoExplosionId ? "Asignación actualizada" : "Asignación agregada");
      limpiarFormularioExplosion();
      await cargarExplosion();
    } catch {
      setErrorExplosion("Error de conexión al guardar la asignación");
    } finally {
      setGuardandoExplosion(false);
    }
  };

  const eliminarExplosion = async (registroId: number) => {
    if (!id || !registroId) return;
    const confirmar = window.confirm("¿Eliminar esta asignación?");
    if (!confirmar) return;
    setGuardandoExplosion(true);
    setErrorExplosion("");
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/explosion-insumos/${registroId}`, {
        method: "DELETE",
        headers: { ...authHeader() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setErrorExplosion(data?.message || "No se pudo eliminar la asignación");
        return;
      }
      setMensaje("Asignación eliminada");
      limpiarFormularioExplosion();
      await cargarExplosion();
    } catch {
      setErrorExplosion("Error de conexión al eliminar la asignación");
    } finally {
      setGuardandoExplosion(false);
    }
  };

  const cargarExplosion = useCallback(async () => {
    if (!id || !isAdmin || !mostrarPedidosModulo) return;
    setCargandoExplosion(true);
    setErrorExplosion("");
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/explosion-insumos`, { headers: { ...authHeader() } });
      const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          const filas: ExplosionRow[] = Array.isArray(data.data)
            ? data.data.map((row: any) => ({
                id: Number(row?.id ?? 0),
                clan: row?.clan ?? "",
                familia: row?.familia ?? "",
                presupuesto_asignado: Number(row?.presupuesto_asignado ?? 0),
                presupuesto_restante: Number(row?.presupuesto_restante ?? row?.presupuesto_usado ?? 0),
                gastado: Number(row?.gastado ?? 0),
              }))
            : [];
        setExplosionInsumos(filas);
        setPresupuestoMiscelBase(Number(data.presupuesto_miscelaneos_base ?? 0));
        setPresupuestoMiscelDisponible(Number(data.presupuesto_miscelaneos_disponible ?? 0));
      } else {
        setErrorExplosion(data?.message || "No se pudo cargar la explosión de insumos");
        setExplosionInsumos([]);
        setPresupuestoMiscelBase(0);
        setPresupuestoMiscelDisponible(0);
      }
    } catch {
      setErrorExplosion("Error de conexión al cargar la explosión de insumos");
      setExplosionInsumos([]);
      setPresupuestoMiscelBase(0);
      setPresupuestoMiscelDisponible(0);
    } finally {
      setCargandoExplosion(false);
    }
  }, [id, isAdmin, mostrarPedidosModulo]);

  const cargarPresupuestosViaticos = useCallback(async () => {
    if (!id) return;
    try {
      setCargandoPresupuestos(true);
      setErrorPresupuestos("");
      const res = await fetch(`http://localhost:3000/proyectos/${id}/viaticos-presupuestos`, {
        headers: { ...authHeader() },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPresupuestosViaticos(data.data || []);
      } else {
        setErrorPresupuestos(data.message || "Error cargando presupuestos");
      }
    } catch {
      setErrorPresupuestos("Error de conexión");
    } finally {
      setCargandoPresupuestos(false);
    }
  }, [id]);

  const cargarMovimientosViaticos = useCallback(async () => {
    if (!id) return;
    try {
      setCargandoMovimientos(true);
      setErrorMovimientos("");

      const params = new URLSearchParams();
      if (familiaFiltro) params.append("familia", familiaFiltro);
      if (fechaDesdeFiltro) params.append("fecha_desde", fechaDesdeFiltro);
      if (fechaHastaFiltro) params.append("fecha_hasta", fechaHastaFiltro);

      const query = params.toString();
      const url = `http://localhost:3000/proyectos/${id}/viaticos-movimientos${query ? `?${query}` : ""}`;

      const res = await fetch(url, { headers: { ...authHeader() } });
      const data = await res.json();

      if (res.ok && data.success) {
        setMovimientosViaticos(data.data || []);
      } else {
        setErrorMovimientos(data.message || "Error cargando movimientos");
      }
    } catch {
      setErrorMovimientos("Error de conexión");
    } finally {
      setCargandoMovimientos(false);
    }
  }, [id, familiaFiltro, fechaDesdeFiltro, fechaHastaFiltro]);

  useEffect(() => {
    if (mostrarViaticos && id) {
      cargarPresupuestosViaticos();
      cargarMovimientosViaticos();
    }
  }, [mostrarViaticos, id, cargarPresupuestosViaticos, cargarMovimientosViaticos]);

  useEffect(() => {
    if (!isTokenValid(getToken())) { navigate("/"); return; }
    cargarProyecto();
    if (isAdmin) {
      cargarPedidos();
      if (mostrarPedidosModulo) {
        cargarExplosion();
      } else {
        setExplosionInsumos([]);
        setPresupuestoMiscelBase(0);
        setPresupuestoMiscelDisponible(0);
        setErrorExplosion("");
      }
    } else {
      setPedidos([]);
      setMensaje("");
      setError("");
      setErrorExplosion("");
      setExplosionInsumos([]);
      setPresupuestoMiscelBase(0);
      setPresupuestoMiscelDisponible(0);
    }
    cargarCobranza();
    cargarHistorialPresupuesto();
  }, [cargarPedidos, cargarProyecto, cargarCobranza, cargarHistorialPresupuesto, navigate, isAdmin, mostrarPedidosModulo, cargarExplosion]);

  useEffect(() => {
    const combinar = (prev: string[], valores: (string | null | undefined)[], adicionales: string[] = []) => {
      const conjunto = new Set<string>(prev);
      valores.forEach((v) => { if (v) conjunto.add(v); });
      adicionales.forEach((v) => { if (v) conjunto.add(v); });
      const ordenado = Array.from(conjunto).sort((a, b) => a.localeCompare(b));
      if (ordenado.length === prev.length && ordenado.every((val, idx) => val === prev[idx])) {
        return prev;
      }
      return ordenado;
    };
    setFamilias((prev) => combinar(prev, pedidos.map((p) => p.familia), familiasSeleccionadas));
    setClanes((prev) => combinar(prev, pedidos.map((p) => p.clan), clanesSeleccionados));
    setProveedores((prev) => combinar(prev, pedidos.map((p) => p.proveedor), proveedoresSeleccionados));
    const conceptoExtra = concepto ? [concepto] : [];
    setConceptos((prev) => combinar(prev, pedidos.map((p) => p.concepto), conceptoExtra));
  }, [pedidos, familiasSeleccionadas, clanesSeleccionados, proveedoresSeleccionados, concepto]);

  const exportarExplosion = useCallback(async () => {
    try {
      if (!id) return;
      const params: string[] = [];
      const agregarLista = (nombre: string, valores: string[]) => {
        if (valores.length) {
          params.push(`${nombre}=${encodeURIComponent(valores.join(","))}`);
        }
      };
      agregarLista("familia", familiasSeleccionadas);
      agregarLista("clan", clanesSeleccionados);
      agregarLista("proveedor", proveedoresSeleccionados);
      if (concepto) params.push(`concepto=${encodeURIComponent(concepto)}`);
      if (fecha) params.push(`fecha=${encodeURIComponent(fecha)}`);
      const qs = params.length ? `?${params.join("&")}` : "";
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos/export${qs}`, { headers: { ...authHeader() } });
      if (!res.ok) { setError("No se pudo generar el archivo"); return; }
      const cd = res.headers.get("Content-Disposition") || "";
      let serverFilename = "";
      const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
      if (m) serverFilename = m[1];
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const famSlug = familiasSeleccionadas.length
        ? `_${familiasSeleccionadas.map((f) => f.replace(/[^A-Za-z0-9_-]+/g, "-")).join("-")}`
        : "";
      a.download = serverFilename || `explosion_insumos_proyecto_${nombreProyecto}${famSlug}_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      setError("Error de conexion al generar exportacion");
    }
  }, [id, familiasSeleccionadas, clanesSeleccionados, proveedoresSeleccionados, concepto, fecha]);

  const limpiarFiltros = useCallback(() => {
    setFamiliasSeleccionadas([]);
    setClanesSeleccionados([]);
    setProveedoresSeleccionados([]);
    setConcepto("");
    setFecha("");
    cargarPedidos({ familias: [], clanes: [], proveedores: [], concepto: "", fecha: "" });
  }, [cargarPedidos]);

  const abrirModalPresupuesto = () => {
    setMensaje("");
    setError("");
    setFormPresupuesto({
      cristal: String(presupuestoCristal ?? 0),
      aluminio: String(presupuestoAluminio ?? 0),
      miscelaneos: String(presupuestoMiscelaneos ?? 0),
      fecha: getTodayISO(),
    });
    setModalPresupuestoAbierto(true);
  };

  const cerrarModalPresupuesto = () => {
    setModalPresupuestoAbierto(false);
  };

  const actualizarCampoPresupuesto = (campo: "cristal" | "aluminio" | "miscelaneos" | "fecha") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormPresupuesto((prev) => ({ ...prev, [campo]: value }));
  };

  const guardarPresupuesto = async (e: FormEvent) => {
    e.preventDefault();
    const cristalNum = parseMontoPositivo(formPresupuesto.cristal);
    const aluminioNum = parseMontoPositivo(formPresupuesto.aluminio);
    const miscelaneosNum = parseMontoPositivo(formPresupuesto.miscelaneos);
    if ([cristalNum, aluminioNum, miscelaneosNum].some((n) => Number.isNaN(n))) {
      setError("Ingresa montos válidos (0 o mayores) para cada familia");
      return;
    }
    setGuardandoPresupuesto(true);
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/presupuesto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          presupuesto_cristal: cristalNum,
          presupuesto_aluminio: aluminioNum,
          presupuesto_miscelaneos: miscelaneosNum,
          fecha_presupuesto: formPresupuesto.fecha,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(data?.message || "No se pudo actualizar el presupuesto");
        return;
      }
      const nuevoTotal = data.data?.presupuesto_total ?? cristalNum + aluminioNum + miscelaneosNum;
      setProyectoInfo((prev) => ({
        ...(prev || {
          id_proyecto: Number(id) || 0,
          nombre: state?.nombre || "Proyecto",
          fecha_proyecto: state?.fecha || "",
        }),
        presupuesto_cristal: cristalNum,
        presupuesto_aluminio: aluminioNum,
        presupuesto_miscelaneos: miscelaneosNum,
        presupuesto_total: nuevoTotal,
        presupuesto: nuevoTotal,
        presupuesto_disponible: nuevoTotal,
      }));
      setMensaje("Presupuestos actualizados correctamente");
      setModalPresupuestoAbierto(false);
      await cargarHistorialPresupuesto();
      await cargarExplosion();
    } catch {
      setError("Error de conexión al actualizar presupuesto");
    } finally {
      setGuardandoPresupuesto(false);
    }
  };

  const alternarOrdenPedidos = useCallback(() => {
    setOrdenPedidos((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const cerrarModalDetalles = useCallback(() => {
    setPedidoSeleccionado(null);
    setDetallesPedido([]);
    setDetallesCristal([]);
    setDetallesAluminio([]);
    setDetalleError("");
  }, []);

  const abrirDetallesPedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setDetallesPedido([]);
    setDetallesCristal([]);
    setDetallesAluminio([]);
    setDetalleError("");
    const familia = (pedido.familia || "").trim().toUpperCase();
    const esCristal = familia === "CR";
    const esAluminio = familia === "AL" || familia === "MQAL";
    setTipoDetallePedido(esCristal ? "cristal" : esAluminio ? "aluminio" : "miscelaneos");
    setCargandoDetalles(true);
    const cargar = async () => {
      try {
        const endpoint = esCristal ? "detalles-cristal" : esAluminio ? "detalles-aluminio" : "detalles";
        const res = await fetch(`http://localhost:3000/pedidos/${pedido.id}/${endpoint}`, { headers: { ...authHeader() } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          const rows = Array.isArray(data.data) ? data.data : [];
          if (esCristal) {
            const parsedCristal: PedidoDetalleCristalItem[] = rows.map((det: any, index: number) => {
              const descripcion = typeof det.descripcion === "string" ? det.descripcion.trim() : String(det.descripcion || "").trim();
              const cleanString = (value: any) => {
                if (value === null || value === undefined) return null;
                const str = typeof value === "string" ? value : String(value);
                const trimmed = str.trim();
                return trimmed.length ? trimmed : null;
              };
              const toNumberValue = (value: any) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : 0;
              };
              const toNullableNumber = (value: any) => {
                if (value === null || value === undefined || value === "") return null;
                const num = Number(value);
                return Number.isFinite(num) ? num : null;
              };
              return {
                id_detalle: typeof det.id_detalle === "number" ? det.id_detalle : index + 1,
                descripcion: descripcion || `Detalle ${index + 1}`,
                clave_modelo: cleanString(det.clave_modelo),
                ancho: toNullableNumber(det.ancho),
                largo: toNullableNumber(det.largo),
                m2_corte: toNullableNumber(det.m2_corte),
                piezas: toNumberValue(det.piezas),
                m2_pedido: toNullableNumber(det.m2_pedido),
                precio_unitario: toNumberValue(det.precio_unitario),
                importe: toNumberValue(det.importe),
              };
            });
            setDetallesCristal(parsedCristal);
          } else if (esAluminio) {
            const parsedAluminio: PedidoDetalleAluminioItem[] = rows.map((det: any, index: number) => {
              const descripcion = typeof det.descripcion === "string" ? det.descripcion.trim() : String(det.descripcion || "").trim();
              const cleanString = (value: any) => {
                if (value === null || value === undefined) return null;
                const str = typeof value === "string" ? value : String(value);
                const trimmed = str.trim();
                return trimmed.length ? trimmed : null;
              };
              const toNumberValue = (value: any) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : 0;
              };
              const toNullableNumber = (value: any) => {
                if (value === null || value === undefined || value === "") return null;
                const num = Number(value);
                return Number.isFinite(num) ? num : null;
              };
              return {
                id_detalle: typeof det.id_detalle === "number" ? det.id_detalle : index + 1,
                descripcion: descripcion || `Detalle ${index + 1}`,
                numero_perfil: cleanString(det.numero_perfil),
                medida_tramo: toNullableNumber(det.medida_tramo),
                unidad: cleanString(det.unidad),
                peso_kg_ml: toNullableNumber(det.peso_kg_ml),
                perimetro_m2_ml: toNullableNumber(det.perimetro_m2_ml),
                acabado: cleanString(det.acabado),
                total_tramos: toNullableNumber(det.total_tramos),
                ml: toNullableNumber(det.ml),
                kg: toNullableNumber(det.kg),
                m2: toNullableNumber(det.m2),
                importe: toNumberValue(det.importe),
              };
            });
            setDetallesAluminio(parsedAluminio);
          } else {
            const parsed: PedidoDetalleItem[] = rows.map((det: any, index: number) => {
              const descripcion = typeof det.descripcion === "string" ? det.descripcion.trim() : String(det.descripcion || "").trim();
              const cleanString = (value: any) => {
                if (value === null || value === undefined) return null;
                const str = typeof value === "string" ? value : String(value);
                const trimmed = str.trim();
                return trimmed.length ? trimmed : null;
              };
              const toNumberValue = (value: any) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : 0;
              };
              const toNullableNumber = (value: any) => {
                if (value === null || value === undefined || value === "") return null;
                const num = Number(value);
                return Number.isFinite(num) ? num : null;
              };
              return {
                id_detalle: typeof det.id_detalle === "number" ? det.id_detalle : index + 1,
                descripcion: descripcion || `Detalle ${index + 1}`,
                unidad: cleanString(det.unidad),
                medida: cleanString(det.medida),
                cantidad: toNumberValue(det.cantidad),
                precio_unitario: toNumberValue(det.precio_unitario),
                importe: toNumberValue(det.importe),
                clave: cleanString(det.clave),
                ml: toNullableNumber(det.ml),
                acabado: cleanString(det.acabado),
                kg: toNullableNumber(det.kg),
                precio_x_kg: toNullableNumber(det.precio_x_kg),
              };
            });
            setDetallesPedido(parsed);
          }
        } else {
          setDetalleError(data?.message || "No se pudieron cargar los detalles del pedido");
        }
      } catch {
        setDetalleError("No se pudieron cargar los detalles del pedido");
      } finally {
        setCargandoDetalles(false);
      }
    };
    cargar();
  };

  const irAVistaPrevia = useCallback(() => {
    if (!pedidoSeleccionado || !id) return;
    const detalleActual = tipoDetallePedido === "cristal"
      ? detallesCristal
      : tipoDetallePedido === "aluminio"
        ? detallesAluminio
        : detallesPedido;
    navigate(`/proyecto/${id}/pedido/${pedidoSeleccionado.id}/vista-previa`, {
      state: {
        pedido: { ...pedidoSeleccionado, nombre_proyecto: nombreProyecto },
        detalles: detalleActual,
        tipoDetalle: tipoDetallePedido,
        proyectoNombre: nombreProyecto,
      },
    });
  }, [detallesAluminio, detallesCristal, detallesPedido, id, navigate, nombreProyecto, pedidoSeleccionado, tipoDetallePedido]);

  useEffect(() => {
    if (!pedidoSeleccionado) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrarModalDetalles();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [pedidoSeleccionado, cerrarModalDetalles]);

  const submitCobranza = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setError("");
      const toNumber = (value: string) => Number(value || 0);
      const numeroValue = Number(numeroRegistro);
      const conceptoLimpio = conceptoCobranza.trim();
      if (!numeroRegistro || Number.isNaN(numeroValue) || conceptoLimpio === "") {
        setError("Captura un número consecutivo y un concepto válido");
        return;
      }
      const body = {
        contratado_a_fecha: toNumber(contratadoFecha),
        mano_obra: toNumber(manoObra),
        cobrado_total: toNumber(cobradoTotal),
        por_cobrar_total: toNumber(porCobrarTotal),
        fondo_garantia: toNumber(fondoGarantia),
        liquido_por_cobrar: toNumber(liquidoPorCobrar),
        numero: numeroValue,
        fecha: fechaDetalle || null,
        numero_factura: numeroFactura || null,
        concepto: conceptoLimpio,
        importe_a_cobrar: toNumber(importeACobrar),
        importe_cobrado: toNumber(importeCobrado),
        saldo_por_cobrar: toNumber(saldoPorCobrar),
        fecha_pago: fechaPago || null,
        periodo: periodoRegistro || null,
        fecha_reporte: fechaReporte,
      };
      const res = await fetch(`http://localhost:3000/proyectos/${id}/cobranza`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "No se pudo agregar cobranza");
        return;
      }
      setMensaje("Cobranza agregada");
      setFormCobranzaAbierto(false);
      setContratadoFecha("");
      setManoObra("");
      setCobradoTotal("");
      setPorCobrarTotal("");
      setFondoGarantia("");
      setLiquidoPorCobrar("");
      setNumeroRegistro("");
      setFechaDetalle("");
      setNumeroFactura("");
      setConceptoCobranza("");
      setImporteACobrar("");
      setImporteCobrado("");
      setSaldoPorCobrar("");
      setFechaPago("");
      setPeriodoRegistro("");
      setFechaReporte(hoyStr);
      cargarCobranza();
    } catch (_) {
      setError("Error de conexion al guardar cobranza");
    }
  };

  return (
    <div className="detalle-page">
      <header className="detalle-header">
        <button className="btn btn-secondary" onClick={volver}>&larr; Regresar</button>
        <h2 className="detalle-titulo">{nombreProyecto}</h2>
        <div className="detalle-actions">
          {mostrarCobranza && !isAdmin && (
            <button className="btn btn-primary" onClick={() => setFormCobranzaAbierto(v => !v)}>
              Agregar cobranza
            </button>
          )}
          {isAdmin && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            style={{ display: "none" }}
            onChange={onFileSelected}
          />
          )}
          {isAdmin && (
          <button className="btn btn-primary" onClick={abrirExplorador} disabled={subiendo}>
            {subiendo ? "Subiendo..." : "Agregar pedidos"}
          </button>
          )}
          {isAdmin && (
          <MultiSelectFilter
            label="Familias"
            placeholder="Todas las familias"
            items={familias}
            selected={familiasSeleccionadas}
            onChange={(seleccion) => {
              setFamiliasSeleccionadas(seleccion);
              cargarPedidos({ familias: seleccion });
            }}
          />
          )}
          {isAdmin && (
          <MultiSelectFilter
            label="Clanes"
            placeholder="Todos los clanes"
            items={clanes}
            selected={clanesSeleccionados}
            onChange={(seleccion) => {
              setClanesSeleccionados(seleccion);
              cargarPedidos({ clanes: seleccion });
            }}
          />
          )}
          {isAdmin && (
          <MultiSelectFilter
            label="Proveedores"
            placeholder="Todos los proveedores"
            items={proveedores}
            selected={proveedoresSeleccionados}
            onChange={(seleccion) => {
              setProveedoresSeleccionados(seleccion);
              cargarPedidos({ proveedores: seleccion });
            }}
          />
          )}
          {isAdmin && (
          <select
            className="filter-select"
            value={concepto}
            onChange={(e) => {
              const value = e.target.value;
              setConcepto(value);
              cargarPedidos({ concepto: value });
            }}
          >
            <option value="">Todos los conceptos</option>
            {conceptos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          )}
          {isAdmin && (
          <input
            className="filter-select"
            type="date"
            value={fecha}
            onChange={(e) => {
              const value = e.target.value;
              setFecha(value);
              cargarPedidos({ fecha: value });
            }}
          />
          )}
          {isAdmin && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={limpiarFiltros}
            disabled={
              familiasSeleccionadas.length === 0 &&
              clanesSeleccionados.length === 0 &&
              proveedoresSeleccionados.length === 0 &&
              !concepto &&
              !fecha
            }
          >
            Limpiar filtros
          </button>
          )}
        </div>
      </header>

      <main className="detalle-contenido">
        <div className="presupuesto-summary">
          <div className="presupuesto-card">
            <span>Presupuesto total cargado</span>
            <strong>{formatCurrency(presupuestoAsignado)}</strong>
            <small>Disponible + pedidos registrados</small>
          </div>
          <div className="presupuesto-card">
            <span>Pedidos registrados</span>
            <strong>{formatCurrency(totalPedidosProyecto)}</strong>
            <small>Aluminio, cristal y misceláneos</small>
          </div>
          <div className={`presupuesto-card ${presupuestoRestanteTotal < 0 ? "presupuesto-alerta" : ""}`}>
            <span>Disponible total</span>
            <strong className={clasePresupuestoDisponible}>{formatCurrency(presupuestoRestanteTotal)}</strong>
            <small>{cargandoProyecto ? "Actualizando..." : "Se descuenta según la familia"}</small>
          </div>
          <div className={`presupuesto-card ${presupuestoCristal < 0 ? "presupuesto-alerta" : ""}`}>
            <span>Disponible cristal</span>
            <strong className={clasePresupuestoCristal}>{formatCurrency(presupuestoCristal)}</strong>
            <small>Pedidos familia CR</small>
          </div>
          <div className={`presupuesto-card ${presupuestoAluminio < 0 ? "presupuesto-alerta" : ""}`}>
            <span>Disponible aluminio</span>
            <strong className={clasePresupuestoAluminio}>{formatCurrency(presupuestoAluminio)}</strong>
            <small>Pedidos familia AL/MQAL</small>
          </div>
          <div className={`presupuesto-card ${presupuestoMiscelaneos < 0 ? "presupuesto-alerta" : ""}`}>
            <span>Disponible misceláneos</span>
            <strong className={clasePresupuestoMiscelaneos}>{formatCurrency(presupuestoMiscelaneos)}</strong>
            <small>Pedidos resto de familias</small>
          </div>
        </div>

        {mostrarHistorialPresupuesto && (
          <section className="historial-presupuesto">
            <div className="historial-header">
              <h3>Historial de presupuestos</h3>
              {isAdmin && (
                <button type="button" className="btn btn-secondary" onClick={abrirModalPresupuesto}>
                  Ajustar presupuesto
                </button>
              )}
            </div>
            {cargandoHistorial ? (
              <p>Cargando historial...</p>
            ) : historialPresupuesto.length === 0 ? (
              <p>No hay cambios registrados.</p>
            ) : (
              <table className="tabla-historial">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cristal</th>
                    <th>Aluminio</th>
                    <th>Misceláneos</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPresupuesto.map((row) => (
                    <tr key={row.id_historial}>
                      <td>{row.fecha_presupuesto}</td>
                      <td>{formatCurrency(row.presupuesto_cristal)}</td>
                      <td>{formatCurrency(row.presupuesto_aluminio)}</td>
                      <td>{formatCurrency(row.presupuesto_miscelaneos)}</td>
                      <td>{formatCurrency(row.presupuesto_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {modalPresupuestoAbierto && (
          <div className="presupuesto-modal-backdrop" onClick={cerrarModalPresupuesto}>
            <div className="presupuesto-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <h3>Ajustar presupuestos</h3>
              <p className="modal-subtitle">Actualiza el disponible por familia y guarda una fecha de referencia.</p>
              <form className="form-presupuesto" onSubmit={guardarPresupuesto}>
                <label>
                  Presupuesto cristal
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPresupuesto.cristal}
                    onChange={actualizarCampoPresupuesto("cristal")}
                    required
                  />
                </label>
                <label>
                  Presupuesto aluminio
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPresupuesto.aluminio}
                    onChange={actualizarCampoPresupuesto("aluminio")}
                    required
                  />
                </label>
                <label>
                  Presupuesto misceláneos
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPresupuesto.miscelaneos}
                    onChange={actualizarCampoPresupuesto("miscelaneos")}
                    required
                  />
                </label>
                <label>
                  Fecha de presupuesto
                  <input
                    type="date"
                    value={formPresupuesto.fecha}
                    onChange={actualizarCampoPresupuesto("fecha")}
                    required
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={cerrarModalPresupuesto} disabled={guardandoPresupuesto}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={guardandoPresupuesto}>
                    {guardandoPresupuesto ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {mensaje && <p className="alert success">{mensaje}</p>}
        {error && <p className="alert error">{error}</p>}
        {!isAdmin || !mostrarPedidosModulo ? null : (
          <>
            <div className="placeholder-card">
              <p>Selecciona uno o varios archivos CSV con el formato esperado para cargar pedidos.</p>
            </div>
            <div className="tabla-wrapper">
              <div className="tabla-toolbar">
                <div className="tabla-header">Pedidos del proyecto</div>
                <div className="tabla-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={alternarOrdenPedidos}
                    disabled={pedidos.length === 0}
                  >
                    Ordenar por fecha ({ordenPedidos === "desc" ? "recientes primero" : "antiguos primero"})
                  </button>
                  <button className="btn btn-primary" onClick={exportarExplosion} disabled={pedidos.length === 0}>
                    Generar explosión de insumos
                  </button>
                </div>
              </div>
              {cargandoPedidos ? (
                <p>Cargando...</p>
              ) : pedidos.length === 0 ? (
                <p style={{ padding: 12 }}>No hay pedidos aun.</p>
              ) : (
                <table className="tabla-pedidos">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Clan</th>
                      <th>Familia</th>
                      <th>Proveedor</th>
                      <th>Fecha Aprobacion</th>
                      <th>Concepto</th>
                      <th>Situaciones</th>
                      <th style={{ textAlign: "right" }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidosOrdenados.map((p) => (
                      <tr
                        key={p.id}
                        className="clickable-row"
                        onClick={() => abrirDetallesPedido(p)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            abrirDetallesPedido(p);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Ver detalles del pedido ${p.pedido}`}
                      >
                        <td>{p.pedido}</td>
                        <td>{p.clan}</td>
                        <td>{p.familia}</td>
                        <td>{p.proveedor}</td>
                        <td>{p.fecha_aprobacion}</td>
                        <td>{p.concepto}</td>
                        <td>{p.situaciones_especiales || "-"}</td>
                        <td style={{ textAlign: "right" }}>
                          {Number(p.importe).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="tabla-wrapper explosion-wrapper">
              <div className="tabla-toolbar">
                <div className="tabla-header">Explosión de insumos</div>
                <div className="tabla-actions explosion-actions-bar">
                </div>
              </div>
              <form className="explosion-form" onSubmit={guardarExplosion}>
                <div className="explosion-grid">
                  <label>
                    Clan
                    <input
                      type="text"
                      value={formExplosion.clan}
                      onChange={(e) => setFormExplosion((prev) => ({ ...prev, clan: e.target.value.toUpperCase() }))}
                      placeholder="Ej. C1"
                    />
                  </label>
                  <label>
                    Familia*
                    <input
                      type="text"
                      value={formExplosion.familia}
                      onChange={(e) => setFormExplosion((prev) => ({ ...prev, familia: e.target.value.toUpperCase() }))}
                      placeholder="Ej. MI"
                      required
                    />
                  </label>
                  <label>
                    Presupuesto asignado*
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formExplosion.presupuesto}
                      onChange={(e) => setFormExplosion((prev) => ({ ...prev, presupuesto: e.target.value }))}
                      placeholder="0.00"
                      required
                    />
                  </label>
                </div>
                <div className="explosion-actions">
                  <button type="submit" className="btn btn-primary" disabled={guardandoExplosion}>
                    {guardandoExplosion ? "Guardando..." : editandoExplosionId ? "Actualizar" : "Asignar presupuesto"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={limpiarFormularioExplosion} disabled={guardandoExplosion}>
                    Limpiar
                  </button>
                  {editandoExplosionId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => eliminarExplosion(editandoExplosionId)}
                      disabled={guardandoExplosion}
                    >
                      Eliminar
                    </button>
                  )}
                  <span className="explosion-hint">Haz clic en una fila para editarla.</span>
                </div>
              </form>
              {errorExplosion && <p className="alert error">{errorExplosion}</p>}
              {cargandoExplosion ? (
                <p>Cargando explosión...</p>
              ) : explosionInsumos.length === 0 ? (
                <p style={{ padding: 12 }}>No hay asignaciones registradas.</p>
              ) : (
                <table className="tabla-explosion">
                  <thead>
                    <tr>
                      <th>N</th>
                      <th>Clan</th>
                      <th>Familia</th>
                      <th>Presupuesto asignado</th>
                      <th>Presupuesto restante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {explosionInsumos.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`clickable-row ${editandoExplosionId === row.id ? "fila-activa" : ""}`}
                        onClick={() => seleccionarExplosion(row)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            seleccionarExplosion(row);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`Editar asignación de ${row.familia || "familia"}`}
                      >
                        <td>{idx + 1}</td>
                        <td>{row.clan || "-"}</td>
                        <td>{row.familia || "-"}</td>
                        <td className="text-right">{formatCurrency(row.presupuesto_asignado)}</td>
                        <td className={`text-right ${row.presupuesto_restante < 0 ? "monto-negativo" : ""}`}>
                          {formatCurrency(row.presupuesto_restante)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {pedidoSeleccionado && (
          <div className="pedido-modal-backdrop" onClick={cerrarModalDetalles}>
            <div
              className="pedido-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pedidoModalTitulo"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pedido-modal-header">
                <div>
                  <h3 id="pedidoModalTitulo" className="pedido-modal-title">
                    Pedido {pedidoSeleccionado.pedido}
                  </h3>
                  <p className="pedido-modal-subtitle">{pedidoSeleccionado.concepto || "-"}</p>
                </div>
                <div className="pedido-modal-actions">
                  <button type="button" className="btn btn-primary" onClick={irAVistaPrevia} disabled={!pedidoSeleccionado}>
                    Ver vista previa
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={cerrarModalDetalles}>
                    Cerrar
                  </button>
                </div>
              </div>
              <div className="pedido-modal-meta">
                <div>
                  <span>Proveedor</span>
                  <strong>{pedidoSeleccionado.proveedor || "-"}</strong>
                </div>
                <div>
                  <span>Clan</span>
                  <strong>{pedidoSeleccionado.clan || "-"}</strong>
                </div>
                <div>
                  <span>Familia</span>
                  <strong>{pedidoSeleccionado.familia || "-"}</strong>
                </div>
                <div>
                  <span>Fecha de aprobación</span>
                  <strong>{pedidoSeleccionado.fecha_aprobacion || "-"}</strong>
                </div>
              </div>
              {detalleError && <p className="pedido-modal-error">{detalleError}</p>}
              {cargandoDetalles ? (
                <p className="pedido-modal-status">Cargando detalles...</p>
              ) : (
                tipoDetallePedido === "cristal"
                  ? detallesCristal.length === 0
                  : tipoDetallePedido === "aluminio"
                    ? detallesAluminio.length === 0
                    : detallesPedido.length === 0
              ) ? (
                <p className="pedido-modal-status">Este pedido no tiene detalles registrados.</p>
              ) : (
                <>
                  <div className="pedido-descripciones">
                    <h4>Descripciones</h4>
                    <ul>
                      {(tipoDetallePedido === "cristal"
                        ? detallesCristal
                        : tipoDetallePedido === "aluminio"
                          ? detallesAluminio
                          : detallesPedido
                      ).map((detalle, index) => (
                        <li key={`${detalle.id_detalle}-${index}`}>
                          <strong>{index + 1}.</strong>{" "}
                          {((detalle as any).descripcion || "").trim() || "-"}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pedido-detalle-ledger">
                    <div className="pedido-detalle-table-wrapper">
                      {tipoDetallePedido === "cristal" ? (
                        <table className="pedido-detalle-table">
                          <thead>
                            <tr>
                              <th>No #</th>
                              <th>Clave/Modelo</th>
                              <th>Ancho</th>
                              <th>Largo</th>
                              <th>M2 corte</th>
                              <th>Piezas</th>
                              <th>M2 pedido</th>
                              <th>P. Unitario</th>
                              <th>Importe (MXN)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detallesCristal.map((detalle, index) => (
                              <tr key={`${detalle.id_detalle}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{detalle.clave_modelo || "-"}</td>
                                <td>{detalle.ancho === null || detalle.ancho === undefined ? "-" : Number(detalle.ancho).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                <td>{detalle.largo === null || detalle.largo === undefined ? "-" : Number(detalle.largo).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                <td>{detalle.m2_corte === null || detalle.m2_corte === undefined ? "-" : Number(detalle.m2_corte).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                <td>{Number(detalle.piezas || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td>{detalle.m2_pedido === null || detalle.m2_pedido === undefined ? "-" : Number(detalle.m2_pedido).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                                <td>{formatCurrency(detalle.precio_unitario)}</td>
                                <td>{formatCurrency(detalle.importe)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : tipoDetallePedido === "aluminio" ? (
                        <table className="pedido-detalle-table">
                          <thead>
                            <tr>
                              <th>No #</th>
                              <th>N° Perfil</th>
                              <th>Medida (tramo)</th>
                              <th>Unidad</th>
                              <th>Peso (KG/ML)</th>
                              <th>Perím (M2/ML)</th>
                              <th>Acabado</th>
                              <th>Total tramos</th>
                              <th>M.L.</th>
                              <th>KG</th>
                              <th>M2</th>
                              <th>Importe (MXN)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detallesAluminio.map((detalle, index) => (
                              <tr key={`${detalle.id_detalle}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{detalle.numero_perfil || "-"}</td>
                                <td>
                                  {detalle.medida_tramo === null || detalle.medida_tramo === undefined
                                    ? "-"
                                    : Number(detalle.medida_tramo).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>{detalle.unidad || "-"}</td>
                                <td>
                                  {detalle.peso_kg_ml === null || detalle.peso_kg_ml === undefined
                                    ? "-"
                                    : Number(detalle.peso_kg_ml).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>
                                  {detalle.perimetro_m2_ml === null || detalle.perimetro_m2_ml === undefined
                                    ? "-"
                                    : Number(detalle.perimetro_m2_ml).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>{detalle.acabado || "-"}</td>
                                <td>
                                  {detalle.total_tramos === null || detalle.total_tramos === undefined
                                    ? "-"
                                    : Number(detalle.total_tramos).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </td>
                                <td>
                                  {detalle.ml === null || detalle.ml === undefined
                                    ? "-"
                                    : Number(detalle.ml).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>
                                  {detalle.kg === null || detalle.kg === undefined
                                    ? "-"
                                    : Number(detalle.kg).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>
                                  {detalle.m2 === null || detalle.m2 === undefined
                                    ? "-"
                                    : Number(detalle.m2).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </td>
                                <td>{formatCurrency(detalle.importe)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="pedido-detalle-table">
                          <thead>
                            <tr>
                              <th>No #</th>
                              <th>Unidad</th>
                              <th>Medida</th>
                              <th>Cantidad</th>
                              <th>P. Unitario</th>
                              <th>Importe (MXN)</th>
                              <th>Clave</th>
                              <th>M.L.</th>
                              <th>Acabado</th>
                              <th>KG</th>
                              <th>Precio x KG</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detallesPedido.map((detalle, index) => (
                              <tr key={`${detalle.id_detalle}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{detalle.unidad || "-"}</td>
                                <td>{detalle.medida || "-"}</td>
                                <td>{Number(detalle.cantidad || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td>{formatCurrency(detalle.precio_unitario)}</td>
                                <td>{formatCurrency(detalle.importe)}</td>
                                <td>{detalle.clave || "-"}</td>
                                <td>
                                  {detalle.ml === null || detalle.ml === undefined
                                    ? "-"
                                    : Number(detalle.ml).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td>{detalle.acabado || "-"}</td>
                                <td>
                                  {detalle.kg === null || detalle.kg === undefined
                                    ? "-"
                                    : Number(detalle.kg).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </td>
                                <td>
                                  {detalle.precio_x_kg === null || detalle.precio_x_kg === undefined
                                    ? "-"
                                    : formatCurrency(detalle.precio_x_kg)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    <div className="pedido-detalle-summary">
                      <div className="pedido-detalle-summary-cell">
                        <span>Importe</span>
                        <strong>{formatCurrency(subtotalBase)}</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>Descuento</span>
                        {porcentajeDescuento > 0 ? (
                          <strong>
                            {formatCurrency(descuentoMonto)} ({porcentajeDescuento.toFixed(2)}%)
                          </strong>
                        ) : (
                          <strong>-</strong>
                        )}
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>Subtotal</span>
                        <strong>{formatCurrency(subtotalConDescuento)}</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>IVA (16%)</span>
                        <strong>{formatCurrency(ivaMonto)}</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell total">
                        <span>Total</span>
                        <strong>{formatCurrency(totalFinal)}</strong>
                      </div>
                    </div>
                    <div className="pedido-detalle-situaciones">
                      <span>Situaciones especiales</span>
                      <p>{pedidoSeleccionado.situaciones_especiales?.trim() || "-"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {mostrarCobranza && (!isAdmin && formCobranzaAbierto) && (
          <div className="placeholder-card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Nueva cobranza</h3>
            <form onSubmit={submitCobranza} className="form-cobranza">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  className="filter-select"
                  type="number"
                  step="1"
                  value={numeroRegistro}
                  onChange={(e) => setNumeroRegistro(e.target.value)}
                  placeholder="No. consecutivo"
                  required
                />
                <input
                  className="filter-select"
                  type="text"
                  value={conceptoCobranza}
                  onChange={(e) => setConceptoCobranza(e.target.value)}
                  placeholder="Concepto (ej. EST 22)"
                  required
                />
                <input
                  className="filter-select"
                  type="text"
                  value={periodoRegistro}
                  onChange={(e) => setPeriodoRegistro(e.target.value)}
                  placeholder="Periodo (ej. 29/03/2025 al 18/04/2025)"
                />
                <input
                  className="filter-select"
                  type="text"
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="No. factura"
                />
                <div className="filter-select-wrapper">
                  <label htmlFor="fechaDetalleInput">Fecha de factura</label>
                  <input
                    id="fechaDetalleInput"
                    className="filter-select"
                    type="date"
                    value={fechaDetalle}
                    onChange={(e) => setFechaDetalle(e.target.value)}
                    aria-label="Fecha de factura o estimación"
                    title="Fecha de factura o estimación"
                    placeholder="Fecha de factura o estimación"
                  />
                </div>
                <div className="filter-select-wrapper">
                  <label htmlFor="fechaPagoInput">Fecha de pago recibido</label>
                  <input
                    id="fechaPagoInput"
                    className="filter-select"
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    aria-label="Fecha de pago recibido"
                    title="Fecha de pago recibido"
                    placeholder="Fecha en que se recibió el pago"
                  />
                </div>
                <div className="filter-select-wrapper">
                  <label htmlFor="fechaReporteInput">Fecha del reporte</label>
                  <input
                    id="fechaReporteInput"
                    className="filter-select"
                    type="date"
                    value={fechaReporte}
                    onChange={(e) => setFechaReporte(e.target.value)}
                    aria-label="Fecha del reporte de cobranza"
                    title="Fecha del reporte de cobranza"
                    placeholder="Fecha del reporte de cobranza"
                  />
                </div>
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={contratadoFecha}
                  onChange={(e) => setContratadoFecha(e.target.value)}
                  placeholder="Contratado a la fecha"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={manoObra}
                  onChange={(e) => setManoObra(e.target.value)}
                  placeholder="Mano de obra"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={cobradoTotal}
                  onChange={(e) => setCobradoTotal(e.target.value)}
                  placeholder="Cobrado total"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={porCobrarTotal}
                  onChange={(e) => setPorCobrarTotal(e.target.value)}
                  placeholder="Por cobrar total"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={fondoGarantia}
                  onChange={(e) => setFondoGarantia(e.target.value)}
                  placeholder="Fondo garantía"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={liquidoPorCobrar}
                  onChange={(e) => setLiquidoPorCobrar(e.target.value)}
                  placeholder="Líquido por cobrar"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={importeACobrar}
                  onChange={(e) => setImporteACobrar(e.target.value)}
                  placeholder="Importe a cobrar"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={importeCobrado}
                  onChange={(e) => setImporteCobrado(e.target.value)}
                  placeholder="Importe cobrado"
                />
                <input
                  className="filter-select"
                  type="number"
                  step="0.01"
                  value={saldoPorCobrar}
                  onChange={(e) => setSaldoPorCobrar(e.target.value)}
                  placeholder="Saldo por cobrar"
                />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setFormCobranzaAbierto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar cobranza</button>
              </div>
            </form>
          </div>
        )}

        {mostrarCobranza && (
          <div className="tabla-wrapper cobranza-wrapper">
            <div className="tabla-toolbar">
              <div className="tabla-header">Cobranza del proyecto</div>
            </div>
            {cargandoCobranza ? (
              <p style={{ padding: 12 }}>Cargando cobranza...</p>
            ) : cobranzas.length === 0 ? (
              <p style={{ padding: 12 }}>No hay registros de cobranza.</p>
            ) : (
              <table className="tabla-pedidos">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Concepto</th>
                    <th>Periodo</th>
                    <th>Fecha</th>
                    <th>Fecha pago</th>
                    <th>No. factura</th>
                    <th style={{ textAlign: 'right' }}>Contratado a la fecha</th>
                    <th style={{ textAlign: 'right' }}>Mano de obra</th>
                    <th style={{ textAlign: 'right' }}>Cobrado total</th>
                    <th style={{ textAlign: 'right' }}>Por cobrar total</th>
                    <th style={{ textAlign: 'right' }}>Importe a cobrar</th>
                    <th style={{ textAlign: 'right' }}>Importe cobrado</th>
                    <th style={{ textAlign: 'right' }}>Saldo por cobrar</th>
                    <th style={{ textAlign: 'right' }}>Fondo garantía</th>
                    <th style={{ textAlign: 'right' }}>Líquido por cobrar</th>
                    <th>Fecha reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {cobranzas.map(c => (
                    <tr key={c.id_cobranza}>
                      <td>{c.numero}</td>
                      <td>{c.concepto || '-'}</td>
                      <td>{c.periodo || '-'}</td>
                      <td>{c.fecha || '-'}</td>
                      <td>{c.fecha_pago || '-'}</td>
                      <td>{c.numero_factura || '-'}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.contratado_a_fecha || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.mano_obra || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.cobrado_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.por_cobrar_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.importe_a_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.importe_cobrado || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.saldo_por_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.fondo_garantia || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>{Number(c.liquido_por_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>{c.fecha_reporte || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* VIÁTICOS MODULE */}
        {mostrarViaticos && (
          <div className="viaticos-container">
            {/* View Toggle */}
            <div className="viaticos-toggle">
              <button
                className={vistaViaticosActiva === "movimientos" ? "active" : ""}
                onClick={() => setVistaViaticosActiva("movimientos")}
              >
                Registrar Pagos en Efectivo
              </button>
              <button
                className={vistaViaticosActiva === "presupuestos" ? "active" : ""}
                onClick={() => setVistaViaticosActiva("presupuestos")}
              >
                Registrar Saldos
              </button>
            </div>

            {/* Cash Movements View */}
            {vistaViaticosActiva === "movimientos" && (
              <div className="seccion-movimientos">
                <div className="movimientos-header">
                  <h3>Pagos en Efectivo</h3>
                  {isAdmin && (
                    <button className="action-button create-button" onClick={() => setModalMovimientoViatico(true)}>
                      Agregar Movimiento
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="movimientos-filtros">
                  <div className="filtro">
                    <label htmlFor="familia-filtro">Familia</label>
                    <select
                      id="familia-filtro"
                      value={familiaFiltro}
                      onChange={(e) => setFamiliaFiltro(e.target.value)}
                    >
                      <option value="">Todas</option>
                      <option value="Mano de Obra">Mano de Obra</option>
                      <option value="Viáticos">Viáticos</option>
                      <option value="Fletes">Fletes</option>
                    </select>
                  </div>
                  <div className="filtro">
                    <label htmlFor="fecha-desde">Desde</label>
                    <input
                      id="fecha-desde"
                      type="date"
                      value={fechaDesdeFiltro}
                      onChange={(e) => setFechaDesdeFiltro(e.target.value)}
                    />
                  </div>
                  <div className="filtro">
                    <label htmlFor="fecha-hasta">Hasta</label>
                    <input
                      id="fecha-hasta"
                      type="date"
                      value={fechaHastaFiltro}
                      onChange={(e) => setFechaHastaFiltro(e.target.value)}
                    />
                  </div>
                  <button
                    className="action-button secondary-button"
                    onClick={() => {
                      setFamiliaFiltro("");
                      setFechaDesdeFiltro("");
                      setFechaHastaFiltro("");
                    }}
                  >
                    Limpiar filtros
                  </button>
                  <button
                    className="action-button primary-button"
                    onClick={async () => {
                      try {
                        const params = new URLSearchParams();
                        if (familiaFiltro) params.append("familia", familiaFiltro);
                        if (fechaDesdeFiltro) params.append("fecha_desde", fechaDesdeFiltro);
                        if (fechaHastaFiltro) params.append("fecha_hasta", fechaHastaFiltro);

                        const res = await fetch(
                          `http://localhost:3000/proyectos/${id}/viaticos-movimientos/export?${params}`,
                          { headers: { ...authHeader() } }
                        );
                        if (!res.ok) throw new Error("Error al exportar");

                        const blob = await res.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `Pagos_Efectivo_${nombreProyecto}_${new Date().toISOString().split("T")[0]}.xlsx`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } catch (err) {
                        console.error("Error exportando:", err);
                        alert("Error al exportar a Excel");
                      }
                    }}
                  >
                    📊 Exportar a Excel
                  </button>
                </div>

                {errorMovimientos && <p className="error-text">{errorMovimientos}</p>}

                {cargandoMovimientos ? (
                  <p>Cargando movimientos...</p>
                ) : movimientosViaticos.length === 0 ? (
                  <p>No hay movimientos registrados</p>
                ) : (
                  <table className="tabla-movimientos">
                    <thead>
                      <tr>
                        <th>N°</th>
                        <th>Nombre</th>
                        <th>Concepto</th>
                        <th>Familia</th>
                        <th>Clave</th>
                        <th>Proyecto</th>
                        <th>Fecha</th>
                        <th className="columna-numero">Ingreso</th>
                        <th className="columna-numero">Egreso</th>
                        <th className="columna-numero">Saldo</th>
                        <th>Observaciones</th>
                        {isAdmin && <th>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosViaticos.map((mov, idx) => (
                        <tr key={mov.id_movimiento}>
                          <td>{idx + 1}</td>
                          <td>{mov.persona}</td>
                          <td>{mov.concepto}</td>
                          <td>{mov.familia}</td>
                          <td>{mov.clave_referencia || "-"}</td>
                          <td>{nombreProyecto}</td>
                          <td>{mov.fecha}</td>
                          <td className="columna-numero">{formatCurrency(mov.ingreso)}</td>
                          <td className="columna-numero">{formatCurrency(mov.egreso)}</td>
                          <td className={`columna-numero ${mov.saldo < 0 ? "negativo" : ""}`}>
                            {formatCurrency(mov.saldo)}
                          </td>
                          <td></td>
                          {isAdmin && (
                            <td>
                              <button
                                className="icon-button trash-button"
                                onClick={async () => {
                                  if (!confirm("¿Eliminar este movimiento?")) return;
                                  try {
                                    const res = await fetch(
                                      `http://localhost:3000/proyectos/${id}/viaticos-movimientos/${mov.id_movimiento}`,
                                      { method: "DELETE", headers: { ...authHeader() } }
                                    );
                                    const data = await res.json();
                                    if (res.ok && data.success) {
                                      await cargarMovimientosViaticos();
                                      await cargarPresupuestosViaticos();
                                    } else {
                                      setErrorMovimientos(data.message || "Error al eliminar");
                                    }
                                  } catch {
                                    setErrorMovimientos("Error de conexión");
                                  }
                                }}
                                aria-label="Eliminar"
                              >
                                🗑️
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Budget Balances View */}
            {vistaViaticosActiva === "presupuestos" && (
              <div className="seccion-presupuestos">
                <div className="presupuestos-header">
                  <h3>Saldos por Familia</h3>
                  {isAdmin && (
                    <button className="action-button create-button" onClick={() => setModalPresupuestoViatico(true)}>
                      Editar Presupuestos
                    </button>
                  )}
                </div>

                {errorPresupuestos && <p className="error-text">{errorPresupuestos}</p>}

                {cargandoPresupuestos ? (
                  <p>Cargando presupuestos...</p>
                ) : presupuestosViaticos.length === 0 ? (
                  <p>No hay presupuestos configurados. Configure los presupuestos para comenzar.</p>
                ) : (
                  <>
                    <div className="presupuestos-grid">
                      {presupuestosViaticos.map((pres) => (
                        <div key={pres.id_presupuesto} className="presupuesto-card">
                          <h4>{pres.familia}</h4>
                          <div className="presupuesto-detalle">
                            <div className="presupuesto-fila">
                              <span>Presupuesto:</span>
                              <strong>{formatCurrency(pres.presupuesto_asignado)}</strong>
                            </div>
                            <div className="presupuesto-fila">
                              <span>Gastado:</span>
                              <strong>{formatCurrency(pres.gastado)}</strong>
                            </div>
                            <div className={`presupuesto-fila ${pres.restante < 0 ? "negativo" : "positivo"}`}>
                              <span>Restante:</span>
                              <strong>{formatCurrency(pres.restante)}</strong>
                            </div>
                          </div>
                          <div className="presupuesto-barra">
                            <div
                              className="presupuesto-progreso"
                              style={{
                                width: `${Math.min((pres.gastado / pres.presupuesto_asignado) * 100, 100)}%`,
                                backgroundColor: pres.restante < 0 ? "#dc3545" : "#28a745"
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Budget Breakdown Table */}
                    <div className="desglose-presupuestos-tabla">
                      <h3>Desglose de Presupuestos por Proyecto</h3>
                      <table className="tabla-desglose-presupuestos">
                        <thead>
                          <tr>
                            <th rowSpan={2}>N°</th>
                            <th rowSpan={2}>PROYECTO</th>
                            <th colSpan={3}>MANO DE OBRA</th>
                            <th colSpan={3}>VIÁTICOS</th>
                            <th colSpan={3}>FLETES</th>
                            <th rowSpan={2}>TOTAL POR EROGAR</th>
                          </tr>
                          <tr>
                            <th>PRESUPUESTO</th>
                            <th>EROGADO</th>
                            <th>POR EROGAR</th>
                            <th>PRESUPUESTO</th>
                            <th>EROGADO</th>
                            <th>POR EROGAR</th>
                            <th>PRESUPUESTO</th>
                            <th>EROGADO</th>
                            <th>POR EROGAR</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>1</td>
                            <td>{nombreProyecto}</td>
                            {(() => {
                              const manoDeObra = presupuestosViaticos.find(p => p.familia === "Mano de Obra");
                              const viaticos = presupuestosViaticos.find(p => p.familia === "Viáticos");
                              const fletes = presupuestosViaticos.find(p => p.familia === "Fletes");
                              const totalPorErogar = (manoDeObra?.restante || 0) + (viaticos?.restante || 0) + (fletes?.restante || 0);

                              return (
                                <>
                                  <td className="columna-numero">{formatCurrency(manoDeObra?.presupuesto_asignado || 0)}</td>
                                  <td className="columna-numero">{formatCurrency(manoDeObra?.gastado || 0)}</td>
                                  <td className={`columna-numero ${(manoDeObra?.restante || 0) < 0 ? "negativo" : ""}`}>
                                    {formatCurrency(manoDeObra?.restante || 0)}
                                  </td>
                                  <td className="columna-numero">{formatCurrency(viaticos?.presupuesto_asignado || 0)}</td>
                                  <td className="columna-numero">{formatCurrency(viaticos?.gastado || 0)}</td>
                                  <td className={`columna-numero ${(viaticos?.restante || 0) < 0 ? "negativo" : ""}`}>
                                    {formatCurrency(viaticos?.restante || 0)}
                                  </td>
                                  <td className="columna-numero">{formatCurrency(fletes?.presupuesto_asignado || 0)}</td>
                                  <td className="columna-numero">{formatCurrency(fletes?.gastado || 0)}</td>
                                  <td className={`columna-numero ${(fletes?.restante || 0) < 0 ? "negativo" : ""}`}>
                                    {formatCurrency(fletes?.restante || 0)}
                                  </td>
                                  <td className={`columna-numero total-column ${totalPorErogar < 0 ? "negativo" : ""}`}>
                                    {formatCurrency(totalPorErogar)}
                                  </td>
                                </>
                              );
                            })()}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Movement Modal */}
            {modalMovimientoViatico && (
              <div className="modal-overlay" onClick={() => setModalMovimientoViatico(false)}>
                <div className="modal modal-viaticos-movimiento" onClick={(e) => e.stopPropagation()}>
                  <h3>Agregar Movimiento</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);

                      const familia = formData.get("familia") as string;
                      const persona = formData.get("persona") as string;
                      const concepto = formData.get("concepto") as string;
                      const clave_referencia = formData.get("clave_referencia") as string;
                      const fecha = formData.get("fecha") as string;
                      const tipo = formData.get("tipo_movimiento") as string;
                      const monto = Number(formData.get("monto"));

                      if (isNaN(monto) || monto <= 0) {
                        setErrorMovimientos("Monto inválido");
                        return;
                      }

                      try {
                        const res = await fetch(`http://localhost:3000/proyectos/${id}/viaticos-movimientos`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...authHeader() },
                          body: JSON.stringify({
                            familia,
                            persona,
                            concepto,
                            clave_referencia: clave_referencia || null,
                            fecha,
                            ingreso: tipo === "ingreso" ? monto : 0,
                            egreso: tipo === "egreso" ? monto : 0,
                          }),
                        });

                        const data = await res.json();
                        if (res.ok && data.success) {
                          setModalMovimientoViatico(false);
                          await cargarMovimientosViaticos();
                          await cargarPresupuestosViaticos();
                        } else {
                          setErrorMovimientos(data.message || "Error al guardar");
                        }
                      } catch {
                        setErrorMovimientos("Error de conexión");
                      }
                    }}
                  >
                    <label>Familia</label>
                    <select name="familia" required>
                      <option value="">Seleccionar...</option>
                      <option value="Mano de Obra">Mano de Obra</option>
                      <option value="Viáticos">Viáticos</option>
                      <option value="Fletes">Fletes</option>
                    </select>

                    <label>Persona</label>
                    <input type="text" name="persona" required placeholder="Nombre" />

                    <label>Concepto</label>
                    <textarea name="concepto" required placeholder="Descripción" rows={3} />

                    <label>Clave/Referencia</label>
                    <input type="text" name="clave_referencia" placeholder="Opcional" />

                    <label>Fecha</label>
                    <input type="date" name="fecha" required defaultValue={getTodayISO()} />

                    <label>Tipo de Movimiento</label>
                    <div className="radio-group">
                      <label>
                        <input type="radio" name="tipo_movimiento" value="egreso" defaultChecked />
                        Egreso (Gasto)
                      </label>
                      <label>
                        <input type="radio" name="tipo_movimiento" value="ingreso" />
                        Ingreso (Reembolso)
                      </label>
                    </div>

                    <label>Monto</label>
                    <input type="number" name="monto" required min="0" step="0.01" placeholder="0.00" />

                    <div className="modal-actions">
                      <button type="button" className="cancel-button" onClick={() => setModalMovimientoViatico(false)}>
                        Cancelar
                      </button>
                      <button type="submit" className="action-button create-button">Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Budget Modal */}
            {modalPresupuestoViatico && (
              <div className="modal-overlay" onClick={() => setModalPresupuestoViatico(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Editar Presupuestos de Viáticos</h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const formData = new FormData(form);

                      const familias = ["Mano de Obra", "Viáticos", "Fletes"];

                      try {
                        for (const familia of familias) {
                          const presupuesto = Number(formData.get(familia));
                          if (isNaN(presupuesto) || presupuesto < 0) {
                            setErrorPresupuestos(`Presupuesto inválido para ${familia}`);
                            return;
                          }

                          const res = await fetch(`http://localhost:3000/proyectos/${id}/viaticos-presupuestos`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...authHeader() },
                            body: JSON.stringify({ familia, presupuesto_asignado: presupuesto }),
                          });

                          const data = await res.json();
                          if (!res.ok || !data.success) {
                            setErrorPresupuestos(data.message || `Error guardando ${familia}`);
                            return;
                          }
                        }

                        setModalPresupuestoViatico(false);
                        await cargarPresupuestosViaticos();
                      } catch {
                        setErrorPresupuestos("Error de conexión");
                      }
                    }}
                  >
                    {["Mano de Obra", "Viáticos", "Fletes"].map((familia) => {
                      const actual = presupuestosViaticos.find((p) => p.familia === familia);
                      return (
                        <div key={familia} className="presupuesto-input-group">
                          <label>{familia}</label>
                          <input
                            type="number"
                            name={familia}
                            min="0"
                            step="0.01"
                            defaultValue={actual?.presupuesto_asignado || 0}
                            required
                          />
                        </div>
                      );
                    })}

                    <div className="modal-actions">
                      <button type="button" className="cancel-button" onClick={() => setModalPresupuestoViatico(false)}>
                        Cancelar
                      </button>
                      <button type="submit" className="action-button create-button">Guardar</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
