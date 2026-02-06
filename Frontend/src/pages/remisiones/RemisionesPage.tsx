import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { authHeader, getToken, isTokenValid } from "../../auth";
import "./RemisionesPage.css";

// --- Types ---

type RemisionRow = {
  id_programacion: number;
  id_proyecto: number;
  nombre_proyecto?: string;
  numero_pedido: string;
  subpedido: string;
  numero_perfil: string;
  descripcion: string;
  medida_tramo: number;
  peso_kg_ml: number;
  acabado: string | null;
  cantidad_pedida: number;
  cantidad_recibida: number;
  cantidad_saldo: number;
  cantidad_extruido: number;
  cantidad_pintado: number;
  total_kg: number;
  kg_saldo: number;
  kg_por_pintar: number;
  kg_entrega: number;
  porcentaje_avance: number;
  proveedor: string;
  fecha_liberacion: string | null;
  fecha_entrega: string | null;
  fecha_entrega_desfazada: string | null;
  fecha_ultima_recepcion: string | null;
  prioridad: 'A' | 'B' | 'C';
  observaciones_proveedor: string | null;
  observaciones_heg: string | null;
  tipo_material: 'aluminio' | 'cristal';
};

type MaterialTab = "aluminio" | "cristal";

// --- Helpers ---

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

const fmtPct = (val: number | null | undefined) => {
  if (val === null || val === undefined) return "0%";
  const num = Number(val) * 100;
  return `${num.toFixed(1)}%`;
};

const fmtDate = (val: string | null | undefined) => {
  if (!val) return "-";
  try {
    return new Date(val).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};

// Convertir fecha ISO a formato input date (YYYY-MM-DD)
const toInputDate = (val: string | null | undefined) => {
  if (!val) return "";
  try {
    const d = new Date(val);
    return d.toISOString().split('T')[0];
  } catch {
    return "";
  }
};

// --- Editable Cell Component (números) ---

type EditableCellProps = {
  value: number;
  onSave: (newValue: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
};

function EditableCell({ value, onSave, min = 0, max, disabled }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const newVal = parseInt(tempValue, 10);
    if (!isNaN(newVal) && newVal >= min && (max === undefined || newVal <= max)) {
      if (newVal !== value) {
        onSave(newVal);
      }
    } else {
      setTempValue(value.toString());
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setTempValue(value.toString());
      setEditing(false);
    }
  };

  if (disabled) {
    return <span className="rem-cell-readonly">{fmtInt(value)}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="rem-cell-input"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
      />
    );
  }

  return (
    <span className="rem-cell-editable" onClick={() => { setTempValue(value.toString()); setEditing(true); }}>
      {fmtInt(value)}
    </span>
  );
}

// --- Editable Date Cell Component ---

type EditableDateCellProps = {
  value: string | null;
  onSave: (newValue: string) => void;
  className?: string;
};

function EditableDateCell({ value, onSave, className }: EditableDateCellProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(toInputDate(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    if (tempValue && tempValue !== toInputDate(value)) {
      onSave(tempValue);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setTempValue(toInputDate(value));
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        className="rem-cell-date-input"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <span
      className={`rem-cell-editable rem-date-editable ${className || ''}`}
      onClick={() => { setTempValue(toInputDate(value)); setEditing(true); }}
    >
      {fmtDate(value)}
    </span>
  );
}

// --- Main Component ---

type RemisionesPageProps = {
  isGeneral?: boolean;
};

export function RemisionesPage({ isGeneral = false }: RemisionesPageProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const nombreProyecto = isGeneral ? "Todos los Proyectos" : ((location.state as { nombreProyecto?: string })?.nombreProyecto || "Proyecto");

  const [materialTab, setMaterialTab] = useState<MaterialTab>("aluminio");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  // Data
  const [datos, setDatos] = useState<RemisionRow[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [proveedorFiltro, setProveedorFiltro] = useState("");

  // Ordenamiento
  const [ordenColumna, setOrdenColumna] = useState<string | null>(null);
  const [ordenDireccion, setOrdenDireccion] = useState<"asc" | "desc">("asc");

  // Build query params
  const buildQueryParams = useCallback(() => {
    const params: string[] = [];
    params.push(`tipo=${materialTab}`);
    if (searchTerm) params.push(`search=${encodeURIComponent(searchTerm)}`);
    if (proveedorFiltro) params.push(`proveedor=${encodeURIComponent(proveedorFiltro)}`);
    return `?${params.join("&")}`;
  }, [materialTab, searchTerm, proveedorFiltro]);

  // Fetch data
  const cargarDatos = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryParams();
      const endpoint = isGeneral
        ? `http://localhost:3000/remisiones${qs}`
        : `http://localhost:3000/proyectos/${projectId}/remisiones${qs}`;
      const res = await fetch(endpoint, { headers: { ...authHeader() } });
      const json = await res.json();
      if (res.ok && json.success) {
        setDatos(json.data || []);
      }
    } catch (err) {
      console.error("Error cargando remisiones:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, isGeneral, buildQueryParams]);

  useEffect(() => {
    if (!isTokenValid(getToken())) {
      navigate("/");
      return;
    }
    cargarDatos();
  }, [cargarDatos, navigate]);

  // Update numeric cell
  const actualizarCelda = async (id: number, campo: string, valor: number, tipoMaterial: string) => {
    setSaving(id);
    try {
      const res = await fetch(`http://localhost:3000/remisiones/${id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor, tipo_material: tipoMaterial })
      });
      if (res.ok) {
        setDatos(prev => prev.map(row => {
          if (row.id_programacion === id && row.tipo_material === tipoMaterial) {
            const updated = { ...row, [campo]: valor };
            if (campo === 'cantidad_recibida' || campo === 'cantidad_pedida') {
              updated.cantidad_saldo = updated.cantidad_pedida - updated.cantidad_recibida;
              updated.kg_saldo = updated.medida_tramo * updated.peso_kg_ml * updated.cantidad_saldo;
              updated.porcentaje_avance = updated.cantidad_pedida > 0 ? updated.cantidad_recibida / updated.cantidad_pedida : 0;
            }
            return updated;
          }
          return row;
        }));
      }
    } catch (err) {
      console.error("Error actualizando:", err);
    } finally {
      setSaving(null);
    }
  };

  // Update date cell
  const actualizarFecha = async (id: number, campo: string, valor: string, tipoMaterial: string) => {
    setSaving(id);
    try {
      const res = await fetch(`http://localhost:3000/remisiones/${id}`, {
        method: "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ [campo]: valor, tipo_material: tipoMaterial })
      });
      if (res.ok) {
        setDatos(prev => prev.map(row => {
          if (row.id_programacion === id && row.tipo_material === tipoMaterial) {
            return { ...row, [campo]: valor };
          }
          return row;
        }));
      }
    } catch (err) {
      console.error("Error actualizando fecha:", err);
    } finally {
      setSaving(null);
    }
  };

  // Export
  const exportarExcel = async () => {
    try {
      const qs = buildQueryParams();
      const endpoint = isGeneral
        ? `http://localhost:3000/remisiones/export${qs}`
        : `http://localhost:3000/proyectos/${projectId}/remisiones/export${qs}`;
      const res = await fetch(endpoint, { headers: { ...authHeader() } });
      if (!res.ok) return;
      const cd = res.headers.get("Content-Disposition") || "";
      let filename = `remisiones_${projectId || 'general'}.xlsx`;
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

  // Sorted & filtered data
  const datosOrdenados = useMemo(() => {
    let filtered = datos;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(row =>
        row.numero_perfil?.toLowerCase().includes(term) ||
        row.descripcion?.toLowerCase().includes(term) ||
        row.numero_pedido?.toLowerCase().includes(term) ||
        row.nombre_proyecto?.toLowerCase().includes(term)
      );
    }

    if (!ordenColumna) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const va = (a as Record<string, unknown>)[ordenColumna];
      const vb = (b as Record<string, unknown>)[ordenColumna];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return ordenDireccion === "desc" ? sorted.reverse() : sorted;
  }, [datos, ordenColumna, ordenDireccion, searchTerm]);

  // Totals
  const totales = useMemo(() => {
    return datosOrdenados.reduce((acc, row) => ({
      total_kg: acc.total_kg + (row.total_kg || 0),
      kg_saldo: acc.kg_saldo + (row.kg_saldo || 0),
      cantidad_pedida: acc.cantidad_pedida + (row.cantidad_pedida || 0),
      cantidad_recibida: acc.cantidad_recibida + (row.cantidad_recibida || 0),
      cantidad_saldo: acc.cantidad_saldo + (row.cantidad_saldo || 0)
    }), { total_kg: 0, kg_saldo: 0, cantidad_pedida: 0, cantidad_recibida: 0, cantidad_saldo: 0 });
  }, [datosOrdenados]);

  // Proveedores únicos para filtro
  const proveedoresUnicos = useMemo(() => {
    const set = new Set(datos.map(d => d.proveedor).filter(Boolean));
    return Array.from(set).sort();
  }, [datos]);

  const isCristal = materialTab === "cristal";

  // --- Render ---

  // Tabla de cristal
  const renderTablaCristal = () => {
    const colCount = 10;
    return (
      <table className="rem-tabla rem-tabla-cristal">
        <thead>
          <tr>
            <th>NO.</th>
            <th className="sortable" onClick={() => manejarOrden("nombre_proyecto")}>PROYECTO{indicadorOrden("nombre_proyecto")}</th>
            <th className="sortable" onClick={() => manejarOrden("numero_pedido")}>PEDIDO{indicadorOrden("numero_pedido")}</th>
            <th className="sortable desc-header" onClick={() => manejarOrden("descripcion")}>DESCRIPCIÓN{indicadorOrden("descripcion")}</th>
            <th>ENTREGAR EN</th>
            <th colSpan={3} className="rem-th-group piezas-group">PIEZAS</th>
            <th className="sortable" onClick={() => manejarOrden("fecha_liberacion")}>FECHA DE LIBERACI&Oacute;N{indicadorOrden("fecha_liberacion")}</th>
            <th className="sortable fecha-pactada-header" onClick={() => manejarOrden("fecha_entrega")}>FECHA DE ENTREGA PACTADA{indicadorOrden("fecha_entrega")}</th>
            <th className="sortable" onClick={() => manejarOrden("fecha_entrega_desfazada")}>FECHA DE ENTREGA DESFAZADA{indicadorOrden("fecha_entrega_desfazada")}</th>
          </tr>
          <tr className="rem-subheader">
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th className="editable-header">PEDIDO</th>
            <th className="editable-header">RECIBIDO</th>
            <th className="editable-header faltante-header">FALTANTE</th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {datosOrdenados.length === 0 ? (
            <tr>
              <td colSpan={colCount + 1} className="rem-empty">
                No hay pedidos de cristal registrados para este proyecto
              </td>
            </tr>
          ) : (
            <>
              {datosOrdenados.map((row, idx) => (
                <tr key={`cristal-${row.id_programacion}`} className={row.cantidad_saldo > 0 ? 'faltante-row' : ''}>
                  <td>{idx + 1}</td>
                  <td className="proyecto-cell">{row.nombre_proyecto || nombreProyecto}</td>
                  <td>{row.numero_pedido}</td>
                  <td className="desc-cell">{row.descripcion}</td>
                  <td className="entregar-cell">{row.nombre_proyecto || nombreProyecto}</td>
                  {/* Piezas editables */}
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_pedida}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_pedida', val, row.tipo_material)}
                    />
                  </td>
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_recibida}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_recibida', val, row.tipo_material)}
                      max={row.cantidad_pedida}
                    />
                  </td>
                  <td className={`faltante-cell ${row.cantidad_saldo > 0 ? 'faltante-pendiente' : 'faltante-completo'}`}>
                    {fmtInt(row.cantidad_saldo)}
                  </td>
                  {/* Fechas editables */}
                  <td className={`fecha-cell editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableDateCell
                      value={row.fecha_liberacion}
                      onSave={(val) => actualizarFecha(row.id_programacion, 'fecha_liberacion', val, row.tipo_material)}
                    />
                  </td>
                  <td className={`fecha-cell fecha-pactada-cell editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableDateCell
                      value={row.fecha_entrega}
                      onSave={(val) => actualizarFecha(row.id_programacion, 'fecha_entrega', val, row.tipo_material)}
                      className="fecha-pactada-value"
                    />
                  </td>
                  <td className={`fecha-cell editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableDateCell
                      value={row.fecha_entrega_desfazada}
                      onSave={(val) => actualizarFecha(row.id_programacion, 'fecha_entrega_desfazada', val, row.tipo_material)}
                    />
                  </td>
                </tr>
              ))}
              {/* Fila de totales */}
              <tr className="rem-totals-row">
                <td colSpan={5} style={{ textAlign: "right", fontWeight: 700 }}>TOTALES</td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_pedida)}</td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_recibida)}</td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_saldo)}</td>
                <td colSpan={3}></td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    );
  };

  // Tabla de aluminio (layout original)
  const renderTablaAluminio = () => {
    const colCount = isGeneral ? 21 : 20;
    return (
      <table className="rem-tabla">
        <thead>
          <tr>
            <th>NO.</th>
            {isGeneral && <th className="sortable" onClick={() => manejarOrden("nombre_proyecto")}>PROYECTO{indicadorOrden("nombre_proyecto")}</th>}
            <th className="sortable" onClick={() => manejarOrden("numero_pedido")}>PEDIDO{indicadorOrden("numero_pedido")}</th>
            <th className="sortable" onClick={() => manejarOrden("subpedido")}>SUB{indicadorOrden("subpedido")}</th>
            <th className="sortable" onClick={() => manejarOrden("numero_perfil")}>PERFIL{indicadorOrden("numero_perfil")}</th>
            <th className="sortable desc-header" onClick={() => manejarOrden("descripcion")}>DESCRIPCI&Oacute;N{indicadorOrden("descripcion")}</th>
            <th className="sortable" onClick={() => manejarOrden("medida_tramo")}>MEDIDA{indicadorOrden("medida_tramo")}</th>
            <th className="sortable" onClick={() => manejarOrden("peso_kg_ml")}>PESO{indicadorOrden("peso_kg_ml")}</th>
            <th className="sortable" onClick={() => manejarOrden("total_kg")}>TOTAL KG{indicadorOrden("total_kg")}</th>
            <th className="sortable acabado-header" onClick={() => manejarOrden("acabado")}>ACABADO{indicadorOrden("acabado")}</th>
            <th colSpan={5} className="rem-th-group control-entregas">CONTROL DE ENTREGAS</th>
            <th className="sortable" onClick={() => manejarOrden("fecha_liberacion")}>F. LIBERACI&Oacute;N{indicadorOrden("fecha_liberacion")}</th>
            <th className="sortable" onClick={() => manejarOrden("fecha_entrega")}>F. ENTREGA{indicadorOrden("fecha_entrega")}</th>
            <th className="sortable" onClick={() => manejarOrden("porcentaje_avance")}>%{indicadorOrden("porcentaje_avance")}</th>
            <th className="sortable" onClick={() => manejarOrden("prioridad")}>PRIO{indicadorOrden("prioridad")}</th>
            <th className="sortable" onClick={() => manejarOrden("kg_saldo")}>KG SALDO{indicadorOrden("kg_saldo")}</th>
          </tr>
          <tr className="rem-subheader">
            <th></th>
            {isGeneral && <th></th>}
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th className="editable-header">PEDIDO</th>
            <th className="editable-header">RECIBIDO</th>
            <th className="editable-header">SALDO</th>
            <th className="editable-header">EXTRUIDO</th>
            <th className="editable-header">PINTADO</th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {datosOrdenados.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="rem-empty">
                No hay pedidos de aluminio registrados para este proyecto
              </td>
            </tr>
          ) : (
            <>
              {datosOrdenados.map((row, idx) => (
                <tr key={`aluminio-${row.id_programacion}`} className={`prioridad-row-${row.prioridad}`}>
                  <td>{idx + 1}</td>
                  {isGeneral && <td className="proyecto-cell">{row.nombre_proyecto}</td>}
                  <td>{row.numero_pedido}</td>
                  <td>{row.subpedido}</td>
                  <td className="perfil-cell">{row.numero_perfil}</td>
                  <td className="desc-cell">{row.descripcion}</td>
                  <td>{fmtDec(row.medida_tramo, 2)}</td>
                  <td>{fmtDec(row.peso_kg_ml, 4)}</td>
                  <td className="kg-cell">{fmtDec(row.total_kg, 2)}</td>
                  <td className="acabado-cell">{row.acabado || "-"}</td>
                  {/* Celdas editables */}
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_pedida}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_pedida', val, row.tipo_material)}
                    />
                  </td>
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_recibida}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_recibida', val, row.tipo_material)}
                      max={row.cantidad_pedida}
                    />
                  </td>
                  <td className="saldo-cell">
                    {fmtInt(row.cantidad_saldo)}
                  </td>
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_extruido}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_extruido', val, row.tipo_material)}
                    />
                  </td>
                  <td className={`editable-cell ${saving === row.id_programacion ? 'saving' : ''}`}>
                    <EditableCell
                      value={row.cantidad_pintado}
                      onSave={(val) => actualizarCelda(row.id_programacion, 'cantidad_pintado', val, row.tipo_material)}
                      max={row.cantidad_extruido}
                    />
                  </td>
                  <td className="fecha-cell">{fmtDate(row.fecha_liberacion)}</td>
                  <td className="fecha-cell">{fmtDate(row.fecha_entrega)}</td>
                  <td className={`pct-cell ${row.porcentaje_avance >= 1 ? 'completo' : row.porcentaje_avance > 0 ? 'parcial' : ''}`}>
                    {fmtPct(row.porcentaje_avance)}
                  </td>
                  <td className={`prioridad-cell prioridad-${row.prioridad}`}>{row.prioridad}</td>
                  <td className="kg-saldo-cell">{fmtDec(row.kg_saldo, 2)}</td>
                </tr>
              ))}
              {/* Fila de totales */}
              <tr className="rem-totals-row">
                <td colSpan={isGeneral ? 9 : 8} style={{ textAlign: "right", fontWeight: 700 }}>TOTALES</td>
                <td style={{ fontWeight: 700 }}>{fmtDec(totales.total_kg, 2)}</td>
                <td></td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_pedida)}</td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_recibida)}</td>
                <td style={{ fontWeight: 700 }}>{fmtInt(totales.cantidad_saldo)}</td>
                <td colSpan={2}></td>
                <td colSpan={3}></td>
                <td></td>
                <td style={{ fontWeight: 700 }}>{fmtDec(totales.kg_saldo, 2)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    );
  };

  return (
    <div className="remisiones-page">
      {/* Navbar */}
      <nav className="rem-navbar">
        <button className="rem-nav-back" onClick={() => navigate("/remisiones")}>
          &larr; Cambiar Proyecto
        </button>
        <div className="rem-nav-project">
          <span className="rem-project-label">Proyecto:</span>
          <span className="rem-project-title">{nombreProyecto}</span>
        </div>
        <div className="rem-nav-tabs">
          {([["aluminio", "Aluminio"], ["cristal", "Cristal"]] as [MaterialTab, string][]).map(([key, label]) => (
            <button
              key={key}
              className={`rem-tab material-tab ${materialTab === key ? 'active' : ''}`}
              onClick={() => setMaterialTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="rem-export-btn" onClick={exportarExcel}>
          Exportar Excel
        </button>
      </nav>

      {/* Filtros */}
      <div className="rem-filtros">
        <div className="rem-filtro-search">
          <label>Buscar</label>
          <input
            type="text"
            placeholder={isCristal ? "Zona, pedido, proyecto..." : "Perfil, descripci\u00F3n, pedido..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {!isCristal && (
          <div className="rem-filtro-select">
            <label>Proveedor</label>
            <select value={proveedorFiltro} onChange={(e) => setProveedorFiltro(e.target.value)}>
              <option value="">Todos</option>
              {proveedoresUnicos.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
        <button className="rem-filtro-reset" onClick={() => { setSearchTerm(""); setProveedorFiltro(""); }}>
          Limpiar
        </button>
        <div className="rem-filtro-stats">
          <span>{datosOrdenados.length} registros</span>
          {!isCristal && (
            <>
              <span className="rem-stat-separator">|</span>
              <span>Total KG: {fmtDec(totales.total_kg, 2)}</span>
              <span className="rem-stat-separator">|</span>
              <span className="rem-stat-saldo">KG Saldo: {fmtDec(totales.kg_saldo, 2)}</span>
            </>
          )}
          {isCristal && (
            <>
              <span className="rem-stat-separator">|</span>
              <span>Piezas: {fmtInt(totales.cantidad_pedida)}</span>
              <span className="rem-stat-separator">|</span>
              <span className="rem-stat-saldo">Faltantes: {fmtInt(totales.cantidad_saldo)}</span>
            </>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="rem-leyenda">
        <span className="rem-leyenda-item editable">
          Click en celdas editables para modificar
        </span>
      </div>

      {/* Tabla */}
      <div className="rem-tabla-container">
        {loading ? (
          <div className="rem-loading">Cargando programaci&oacute;n de entregas...</div>
        ) : (
          isCristal ? renderTablaCristal() : renderTablaAluminio()
        )}
      </div>
    </div>
  );
}
