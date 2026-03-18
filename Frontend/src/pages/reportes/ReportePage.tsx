import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BackButton } from "../../components/BackButton";
import { authHeader, getToken, isTokenValid } from "../../auth";
import "./ReportePage.css";
import API_URL from "../../config";

// --- Types ---

type ReporteCristalRow = {
  id_detalle: number;
  id_pedido: number;
  pedido: string;
  proveedor: string;
  clan: string;
  concepto: string;
  fecha_aprobacion: string;
  descripcion: string;
  clave_modelo: string | null;
  ancho: number | null;
  largo: number | null;
  m2_corte: number | null;
  piezas: number;
  m2_pedido: number | null;
  precio_unitario: number;
  importe: number;
};

type ReporteAluminioRow = {
  id_detalle: number;
  id_pedido: number;
  pedido: string;
  proveedor: string;
  clan: string;
  concepto: string;
  fecha_aprobacion: string;
  descripcion: string;
  numero_perfil: string | null;
  medida_tramo: number | null;
  unidad: string | null;
  peso_kg_ml: number | null;
  perimetro_m2_ml: number | null;
  acabado: string | null;
  total_tramos: number | null;
  ml: number | null;
  kg: number | null;
  m2: number | null;
  importe: number;
};

type FiltrosDisponibles = {
  proveedores: string[];
  clanes: string[];
  conceptos: string[];
  pedidos: string[];
  acabados?: string[];
};

type Totals = {
  total_piezas?: number;
  total_m2_pedido?: number;
  total_tramos?: number;
  total_ml?: number;
  total_kg?: number;
  total_m2?: number;
  total_importe: number;
};

type TabKey = "cristal" | "aluminio";

// --- Helpers ---

const formatCurrency = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtDec = (val: number | null | undefined, decimals = 3) => {
  if (val === null || val === undefined) return "-";
  const num = Number(val);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

const fmtInt = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "-";
  const num = Number(val);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

// --- MultiSelectFilter (local copy) ---

type MultiSelectFilterProps = {
  label: string;
  placeholder: string;
  items: string[];
  selected: string[];
  onChange: (values: string[]) => void;
};

function MultiSelectFilter({ label, placeholder, items, selected, onChange }: MultiSelectFilterProps) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement | null>(null);

  const opciones = useMemo(() => {
    const conjunto = new Set(items);
    selected.forEach((v) => conjunto.add(v));
    return Array.from(conjunto).sort((a, b) => a.localeCompare(b));
  }, [items, selected]);

  const resumen =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.slice(0, 2).join(", ")}${selected.length > 2 ? ` +${selected.length - 2}` : ""}`;

  const cerrar = useCallback(() => setAbierto(false), []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!abierto) return;
      if (contenedorRef.current && !contenedorRef.current.contains(event.target as Node)) cerrar();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (abierto && event.key === "Escape") {
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

  return (
    <div className={`rpt-multi-filter${abierto ? " abierto" : ""}`} ref={contenedorRef}>
      <button type="button" className="rpt-multi-trigger" onClick={() => setAbierto((p) => !p)}>
        <span className="rpt-multi-label">{label}</span>
        <span className="rpt-multi-value">{resumen}</span>
        <span className="rpt-multi-icon" aria-hidden="true">&#9662;</span>
      </button>
      {abierto && (
        <div className="rpt-multi-panel">
          {opciones.length === 0 ? (
            <div className="rpt-multi-empty">Sin opciones</div>
          ) : (
            <ul className="rpt-multi-options">
              {opciones.map((valor) => (
                <li key={valor}>
                  <label className="rpt-multi-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(valor)}
                      onChange={() => {
                        const next = selected.includes(valor)
                          ? selected.filter((v) => v !== valor)
                          : [...selected, valor];
                        onChange(next);
                      }}
                    />
                    <span>{valor}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="rpt-multi-close" onClick={cerrar}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

export function ReportePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nombreProyecto = (location.state as { nombreProyecto?: string })?.nombreProyecto || "Proyecto";

  const [tabActiva, setTabActiva] = useState<TabKey>("cristal");
  const [loading, setLoading] = useState(false);

  // Data
  const [datosCristal, setDatosCristal] = useState<ReporteCristalRow[]>([]);
  const [datosAluminio, setDatosAluminio] = useState<ReporteAluminioRow[]>([]);
  const [totalsCristal, setTotalsCristal] = useState<Totals | null>(null);
  const [totalsAluminio, setTotalsAluminio] = useState<Totals | null>(null);
  const [filtrosDisponiblesCristal, setFiltrosDisponiblesCristal] = useState<FiltrosDisponibles>({ proveedores: [], clanes: [], conceptos: [], pedidos: [] });
  const [filtrosDisponiblesAluminio, setFiltrosDisponiblesAluminio] = useState<FiltrosDisponibles>({ proveedores: [], clanes: [], conceptos: [], pedidos: [], acabados: [] });

  // Filtros
  const [proveedoresSeleccionados, setProveedoresSeleccionados] = useState<string[]>([]);
  const [clanesSeleccionados, setClanesSeleccionados] = useState<string[]>([]);
  const [pedidosFiltro, setPedidosFiltro] = useState<string[]>([]);
  const [conceptoFiltro, setConceptoFiltro] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [acabadosFiltro, setAcabadosFiltro] = useState<string[]>([]);
  const [claveModeloFiltro, setClaveModeloFiltro] = useState("");

  // Ordenamiento
  const [ordenColumna, setOrdenColumna] = useState<string | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<"asc" | "desc">("asc");

  const filtrosActivos = tabActiva === "cristal" ? filtrosDisponiblesCristal : filtrosDisponiblesAluminio;

  const resetFilters = () => {
    setProveedoresSeleccionados([]);
    setClanesSeleccionados([]);
    setPedidosFiltro([]);
    setConceptoFiltro("");
    setFechaDesde("");
    setFechaHasta("");
    setAcabadosFiltro([]);
    setClaveModeloFiltro("");
    setOrdenColumna(null);
    setOrdenDireccion("asc");
  };

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params: string[] = [];
    const agregarLista = (nombre: string, valores: string[]) => {
      if (valores.length) params.push(`${nombre}=${encodeURIComponent(valores.join(","))}`);
    };
    agregarLista("proveedor", proveedoresSeleccionados);
    agregarLista("clan", clanesSeleccionados);
    agregarLista("pedido", pedidosFiltro);
    if (conceptoFiltro) params.push(`concepto=${encodeURIComponent(conceptoFiltro)}`);
    if (fechaDesde) params.push(`fecha_desde=${encodeURIComponent(fechaDesde)}`);
    if (fechaHasta) params.push(`fecha_hasta=${encodeURIComponent(fechaHasta)}`);
    if (tabActiva === "cristal" && claveModeloFiltro) {
      params.push(`clave_modelo=${encodeURIComponent(claveModeloFiltro)}`);
    }
    if (tabActiva === "aluminio") {
      agregarLista("acabado", acabadosFiltro);
    }
    return params.length ? `?${params.join("&")}` : "";
  }, [proveedoresSeleccionados, clanesSeleccionados, pedidosFiltro, conceptoFiltro, fechaDesde, fechaHasta, claveModeloFiltro, acabadosFiltro, tabActiva]);

  // Fetch data
  const cargarReporte = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const qs = buildQueryParams();
      const endpoint = `${API_URL}/proyectos/${projectId}/reportes/${tabActiva}${qs}`;
      const res = await fetch(endpoint, { headers: { ...authHeader() } });
      const json = await res.json();
      if (res.ok && json.success) {
        if (tabActiva === "cristal") {
          setDatosCristal(json.data);
          setTotalsCristal(json.totals);
          setFiltrosDisponiblesCristal(json.filtros_disponibles);
        } else {
          setDatosAluminio(json.data);
          setTotalsAluminio(json.totals);
          setFiltrosDisponiblesAluminio(json.filtros_disponibles);
        }
      }
    } catch (err) {
      console.error("Error cargando reporte:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, tabActiva, buildQueryParams]);

  useEffect(() => {
    if (!isTokenValid(getToken())) {
      navigate("/");
      return;
    }
    cargarReporte();
  }, [cargarReporte, navigate]);

  // Export
  const exportarExcel = async () => {
    try {
      const qs = buildQueryParams();
      const endpoint = `${API_URL}/proyectos/${projectId}/reportes/${tabActiva}/export${qs}`;
      const res = await fetch(endpoint, { headers: { ...authHeader() } });
      if (!res.ok) return;
      const cd = res.headers.get("Content-Disposition") || "";
      let filename = `reporte_${tabActiva}_${projectId}.xlsx`;
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
      console.error("Error exportando Excel");
    }
  };

  // Sorting
  const manejarOrden = (columna: string) => {
    if (ordenColumna === columna) {
      setOrdenDireccion((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setOrdenColumna(columna);
      setOrdenDireccion("asc");
    }
  };

  const indicadorOrden = (columna: string) => {
    if (ordenColumna !== columna) return "";
    return ordenDireccion === "asc" ? " ▲" : " ▼";
  };

  // Sorted data
  const datosCristalOrdenados = useMemo(() => {
    if (!ordenColumna) return datosCristal;
    const sorted = [...datosCristal].sort((a, b) => {
      const va = (a as Record<string, unknown>)[ordenColumna];
      const vb = (b as Record<string, unknown>)[ordenColumna];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return ordenDireccion === "desc" ? sorted.reverse() : sorted;
  }, [datosCristal, ordenColumna, ordenDireccion]);

  const datosAluminioOrdenados = useMemo(() => {
    if (!ordenColumna) return datosAluminio;
    const sorted = [...datosAluminio].sort((a, b) => {
      const va = (a as Record<string, unknown>)[ordenColumna];
      const vb = (b as Record<string, unknown>)[ordenColumna];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return ordenDireccion === "desc" ? sorted.reverse() : sorted;
  }, [datosAluminio, ordenColumna, ordenDireccion]);

  // --- Render ---

  return (
    <div className="reporte-page">
      {/* Navbar */}
      <nav className="reporte-navbar">
        <BackButton />
        <div className="reporte-nav-project">
          <span className="reporte-project-label">Proyecto:</span>
          <span className="reporte-project-title">{nombreProyecto}</span>
        </div>
        <div className="reporte-nav-tabs">
          <button
            className={`reporte-tab${tabActiva === "cristal" ? " active" : ""}`}
            onClick={() => { setTabActiva("cristal"); resetFilters(); }}
          >
            Cristal
          </button>
          <button
            className={`reporte-tab${tabActiva === "aluminio" ? " active" : ""}`}
            onClick={() => { setTabActiva("aluminio"); resetFilters(); }}
          >
            Aluminio
          </button>
        </div>
        <button className="reporte-export-btn" onClick={exportarExcel}>
          Exportar Excel
        </button>
      </nav>

      {/* Filtros */}
      <div className="reporte-filtros">
        <MultiSelectFilter
          label="Proveedor"
          placeholder="Todos"
          items={filtrosActivos.proveedores}
          selected={proveedoresSeleccionados}
          onChange={setProveedoresSeleccionados}
        />
        <MultiSelectFilter
          label="Clan"
          placeholder="Todos"
          items={filtrosActivos.clanes}
          selected={clanesSeleccionados}
          onChange={setClanesSeleccionados}
        />
        <MultiSelectFilter
          label="Pedido"
          placeholder="Todos"
          items={filtrosActivos.pedidos}
          selected={pedidosFiltro}
          onChange={setPedidosFiltro}
        />
        <div className="reporte-filtro-select">
          <label>Concepto</label>
          <select value={conceptoFiltro} onChange={(e) => setConceptoFiltro(e.target.value)}>
            <option value="">Todos</option>
            {filtrosActivos.conceptos.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="reporte-filtro-date">
          <label>Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="reporte-filtro-date">
          <label>Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        {tabActiva === "cristal" && (
          <div className="reporte-filtro-text">
            <label>Clave/Modelo</label>
            <input
              type="text"
              value={claveModeloFiltro}
              onChange={(e) => setClaveModeloFiltro(e.target.value)}
              placeholder="Buscar..."
            />
          </div>
        )}
        {tabActiva === "aluminio" && (
          <MultiSelectFilter
            label="Acabado"
            placeholder="Todos"
            items={filtrosActivos.acabados || []}
            selected={acabadosFiltro}
            onChange={setAcabadosFiltro}
          />
        )}
        <button className="reporte-filtro-reset" onClick={resetFilters}>
          Limpiar filtros
        </button>
      </div>

      {/* Table */}
      <div className="reporte-tabla-container">
        {loading ? (
          <div className="reporte-loading">Cargando reporte...</div>
        ) : tabActiva === "cristal" ? (
          <table className="reporte-tabla">
            <thead>
              <tr>
                <th>NO.</th>
                <th className="sortable" onClick={() => manejarOrden("pedido")}>PEDIDO{indicadorOrden("pedido")}</th>
                <th className="sortable" onClick={() => manejarOrden("proveedor")}>PROVEEDOR{indicadorOrden("proveedor")}</th>
                <th className="sortable" onClick={() => manejarOrden("clan")}>CLAN{indicadorOrden("clan")}</th>
                <th className="sortable" onClick={() => manejarOrden("concepto")}>CONCEPTO{indicadorOrden("concepto")}</th>
                <th className="sortable" onClick={() => manejarOrden("fecha_aprobacion")}>FECHA{indicadorOrden("fecha_aprobacion")}</th>
                <th className="sortable" onClick={() => manejarOrden("clave_modelo")}>CLAVE/MODELO{indicadorOrden("clave_modelo")}</th>
                <th className="sortable" onClick={() => manejarOrden("descripcion")}>DESCRIPCION{indicadorOrden("descripcion")}</th>
                <th className="sortable" onClick={() => manejarOrden("ancho")}>ANCHO{indicadorOrden("ancho")}</th>
                <th className="sortable" onClick={() => manejarOrden("largo")}>LARGO{indicadorOrden("largo")}</th>
                <th className="sortable" onClick={() => manejarOrden("m2_corte")}>M2 CORTE{indicadorOrden("m2_corte")}</th>
                <th className="sortable" onClick={() => manejarOrden("piezas")}>PIEZAS{indicadorOrden("piezas")}</th>
                <th className="sortable" onClick={() => manejarOrden("m2_pedido")}>M2 PEDIDO{indicadorOrden("m2_pedido")}</th>
                <th className="sortable" onClick={() => manejarOrden("precio_unitario")}>P. UNITARIO{indicadorOrden("precio_unitario")}</th>
                <th className="sortable" onClick={() => manejarOrden("importe")}>IMPORTE{indicadorOrden("importe")}</th>
              </tr>
            </thead>
            <tbody>
              {datosCristalOrdenados.length === 0 ? (
                <tr><td colSpan={15} className="reporte-empty">No hay datos de cristal para este proyecto</td></tr>
              ) : (
                <>
                  {datosCristalOrdenados.map((row, idx) => (
                    <tr key={`${row.id_detalle}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{row.pedido}</td>
                      <td>{row.proveedor}</td>
                      <td>{row.clan}</td>
                      <td>{row.concepto}</td>
                      <td>{row.fecha_aprobacion}</td>
                      <td>{row.clave_modelo || "-"}</td>
                      <td className="desc-cell">{row.descripcion}</td>
                      <td>{fmtDec(row.ancho)}</td>
                      <td>{fmtDec(row.largo)}</td>
                      <td>{fmtDec(row.m2_corte)}</td>
                      <td>{fmtInt(row.piezas)}</td>
                      <td>{fmtDec(row.m2_pedido)}</td>
                      <td>{formatCurrency(row.precio_unitario)}</td>
                      <td>{formatCurrency(row.importe)}</td>
                    </tr>
                  ))}
                  {totalsCristal && (
                    <tr className="reporte-totals-row">
                      <td colSpan={11} style={{ textAlign: "right", fontWeight: 700 }}>TOTALES</td>
                      <td style={{ fontWeight: 700 }}>{fmtInt(totalsCristal.total_piezas)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDec(totalsCristal.total_m2_pedido)}</td>
                      <td></td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(totalsCristal.total_importe)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        ) : (
          <table className="reporte-tabla">
            <thead>
              <tr>
                <th>NO.</th>
                <th className="sortable" onClick={() => manejarOrden("pedido")}>PEDIDO{indicadorOrden("pedido")}</th>
                <th className="sortable" onClick={() => manejarOrden("proveedor")}>PROVEEDOR{indicadorOrden("proveedor")}</th>
                <th className="sortable" onClick={() => manejarOrden("clan")}>CLAN{indicadorOrden("clan")}</th>
                <th className="sortable" onClick={() => manejarOrden("concepto")}>CONCEPTO{indicadorOrden("concepto")}</th>
                <th className="sortable" onClick={() => manejarOrden("fecha_aprobacion")}>FECHA{indicadorOrden("fecha_aprobacion")}</th>
                <th className="sortable" onClick={() => manejarOrden("descripcion")}>DESCRIPCION{indicadorOrden("descripcion")}</th>
                <th className="sortable" onClick={() => manejarOrden("numero_perfil")}>N° PERFIL{indicadorOrden("numero_perfil")}</th>
                <th className="sortable" onClick={() => manejarOrden("medida_tramo")}>MEDIDA(TRAMO){indicadorOrden("medida_tramo")}</th>
                <th className="sortable" onClick={() => manejarOrden("unidad")}>UNIDAD{indicadorOrden("unidad")}</th>
                <th className="sortable" onClick={() => manejarOrden("peso_kg_ml")}>PESO(KG/ML){indicadorOrden("peso_kg_ml")}</th>
                <th className="sortable" onClick={() => manejarOrden("perimetro_m2_ml")}>PERIM(M2/ML){indicadorOrden("perimetro_m2_ml")}</th>
                <th className="sortable" onClick={() => manejarOrden("acabado")}>ACABADO{indicadorOrden("acabado")}</th>
                <th className="sortable" onClick={() => manejarOrden("total_tramos")}>TOTAL TRAMOS{indicadorOrden("total_tramos")}</th>
                <th className="sortable" onClick={() => manejarOrden("ml")}>ML{indicadorOrden("ml")}</th>
                <th className="sortable" onClick={() => manejarOrden("kg")}>KG{indicadorOrden("kg")}</th>
                <th className="sortable" onClick={() => manejarOrden("m2")}>M2{indicadorOrden("m2")}</th>
                <th className="sortable" onClick={() => manejarOrden("importe")}>IMPORTE{indicadorOrden("importe")}</th>
              </tr>
            </thead>
            <tbody>
              {datosAluminioOrdenados.length === 0 ? (
                <tr><td colSpan={18} className="reporte-empty">No hay datos de aluminio para este proyecto</td></tr>
              ) : (
                <>
                  {datosAluminioOrdenados.map((row, idx) => (
                    <tr key={`${row.id_detalle}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>{row.pedido}</td>
                      <td>{row.proveedor}</td>
                      <td>{row.clan}</td>
                      <td>{row.concepto}</td>
                      <td>{row.fecha_aprobacion}</td>
                      <td className="desc-cell">{row.descripcion}</td>
                      <td>{row.numero_perfil || "-"}</td>
                      <td>{fmtDec(row.medida_tramo)}</td>
                      <td>{row.unidad || "-"}</td>
                      <td>{fmtDec(row.peso_kg_ml)}</td>
                      <td>{fmtDec(row.perimetro_m2_ml)}</td>
                      <td>{row.acabado || "-"}</td>
                      <td>{fmtInt(row.total_tramos)}</td>
                      <td>{fmtDec(row.ml)}</td>
                      <td>{fmtDec(row.kg)}</td>
                      <td>{fmtDec(row.m2)}</td>
                      <td>{formatCurrency(row.importe)}</td>
                    </tr>
                  ))}
                  {totalsAluminio && (
                    <tr className="reporte-totals-row">
                      <td colSpan={13} style={{ textAlign: "right", fontWeight: 700 }}>TOTALES</td>
                      <td style={{ fontWeight: 700 }}>{fmtInt(totalsAluminio.total_tramos)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDec(totalsAluminio.total_ml)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDec(totalsAluminio.total_kg)}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDec(totalsAluminio.total_m2)}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(totalsAluminio.total_importe)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Row count */}
      <div className="reporte-row-count">
        {tabActiva === "cristal"
          ? `${datosCristal.length} registro${datosCristal.length !== 1 ? "s" : ""}`
          : `${datosAluminio.length} registro${datosAluminio.length !== 1 ? "s" : ""}`}
      </div>
    </div>
  );
}
