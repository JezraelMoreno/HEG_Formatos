import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { authHeader, getToken, isTokenValid, getRole } from "../auth";

import "./proyectoDetalle.css";

type PedidoCsv = {
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string;
  importe: number;
};

type Pedido = {
  id: number;
  id_proyecto: number;
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string | null;
  importe: number;
};

type Cobranza = {
  id_cobranza: number;
  id_proyecto: number;
  proyecto: string;
  control: string;
  importe_contratado: number;
  importe_cobrado: number;
  importe_a_cobrar: number;
  fondo_garantia: number;
  liquido_por_cobrar: number;
  facturas_por_cobrar: number;
  factor: number;
  indirectos_esperado: number;
  indirectos_cobrado: number;
  indirectos_aplicado: number;
  cobrado_vs_aplicado: number;
  numero_factura?: string | null;
  fecha_factura?: string | null;
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
  const { state } = useLocation() as { state?: { nombre?: string; fecha?: string } };
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);

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

  const nombreProyecto = state?.nombre || "Proyecto";
  const role = (getRole() || '').toLowerCase();
  const isAdmin = role === 'administrador';

  // cobranza
  const [cargandoCobranza, setCargandoCobranza] = useState(false);
  const [cobranzas, setCobranzas] = useState<Cobranza[]>([]);
  const [formCobranzaAbierto, setFormCobranzaAbierto] = useState(false);
  const hoyISO = new Date();
  const hoyStr = `${hoyISO.getFullYear()}-${String(hoyISO.getMonth()+1).padStart(2,'0')}-${String(hoyISO.getDate()).padStart(2,'0')}`;
  const [fcReporte, setFcReporte] = useState<string>(hoyStr);
  const [fcFactura, setFcFactura] = useState<string>("");
  const [numFactura, setNumFactura] = useState<string>("");
  const [control, setControl] = useState<string>("");
  const [impContratado, setImpContratado] = useState<string>("");
  const [impCobrado, setImpCobrado] = useState<string>("");
  const [impACobrar, setImpACobrar] = useState<string>("");
  const [fondoGarantia, setFondoGarantia] = useState<string>("");
  const [liqPorCobrar, setLiqPorCobrar] = useState<string>("");
  const [facturasPorCobrar, setFacturasPorCobrar] = useState<string>("");
  const [factor, setFactor] = useState<string>("");
  const [indEsperado, setIndEsperado] = useState<string>("");
  const [indCobrado, setIndCobrado] = useState<string>("");
  const [indAplicado, setIndAplicado] = useState<string>("");
  const [cobVsApl, setCobVsApl] = useState<string>("");

  const abrirExplorador = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const normalizarFecha = (valor: string) => {
    const v = String(valor || "").trim();
    const m = v.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return v;
  };

  const parseCsv = (text: string): PedidoCsv[] => {
    const rows = text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 0);
    if (rows.length < 2) return [];
    const headers = rows[0].split(",").map(h => h.trim().toUpperCase());
    const idx = (n: string) => headers.indexOf(n);
    const iProyecto = idx("PROYECTO");
    const iPedido = idx("PEDIDO");
    const iClan = idx("CLAN");
    const iFamilia = idx("FAMILIA");
    const iProveedor = idx("PROVEEDOR");
    const iFecha = idx("FECHA DE APROBACION");
    const iConcepto = idx("CONCEPTO");
    const iSitEsp = (() => { const i1 = headers.indexOf("SITUACIONES ESPECIALES"); return i1 >= 0 ? i1 : headers.indexOf("SITUACIONES ESPECIALES "); })();
    const iImporte = idx("IMPORTE");
    const out: PedidoCsv[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r].split(",");
      if (cols.length < 5) continue;
      out.push({
        nombre_proyecto: (cols[iProyecto] || nombreProyecto || "").trim(),
        pedido: (cols[iPedido] || "").trim(),
        clan: (cols[iClan] || "").trim(),
        familia: (cols[iFamilia] || "").trim(),
        proveedor: (cols[iProveedor] || "").trim(),
        fecha_aprobacion: normalizarFecha(cols[iFecha] || ""),
        concepto: (cols[iConcepto] || "").trim(),
        situaciones_especiales: (cols[iSitEsp] || "").trim(),
        importe: Number((cols[iImporte] || "0").toString().replace(/\s/g, "")),
      });
    }
    return out;
  };

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

  useEffect(() => {
    if (!isTokenValid(getToken())) { navigate("/"); return; }
    if (isAdmin) {
      cargarPedidos();
    } else {
      setPedidos([]);
      setMensaje("");
      setError("");
    }
  }, [cargarPedidos, navigate, isAdmin]);

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
      a.download = serverFilename || `explosion_insumos_proyecto_${id}${famSlug}_${today}.xlsx`;
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

  useEffect(() => {
    if (!isTokenValid(getToken())) { navigate("/"); return; }
    if (isAdmin) {
      cargarPedidos();
    }
    cargarCobranza();
  }, [cargarPedidos, cargarCobranza, navigate, isAdmin]);

  const submitCobranza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setError("");
      const body = {
        proyecto: nombreProyecto,
        control: control,
        importe_contratado: Number(impContratado || 0),
        importe_cobrado: Number(impCobrado || 0),
        importe_a_cobrar: Number(impACobrar || 0),
        fondo_garantia: Number(fondoGarantia || 0),
        liquido_por_cobrar: Number(liqPorCobrar || 0),
        facturas_por_cobrar: Number(facturasPorCobrar || 0),
        factor: Number(factor || 0),
        indirectos_esperado: Number(indEsperado || 0),
        indirectos_cobrado: Number(indCobrado || 0),
        indirectos_aplicado: Number(indAplicado || 0),
        cobrado_vs_aplicado: Number(cobVsApl || 0),
        numero_factura: numFactura || null,
        fecha_factura: fcFactura || null,
        fecha_reporte: fcReporte,
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
      setFcReporte(hoyStr);
      setFcFactura("");
      setNumFactura("");
      setControl("");
      setImpContratado("");
      setImpCobrado("");
      setImpACobrar("");
      setFondoGarantia("");
      setLiqPorCobrar("");
      setFacturasPorCobrar("");
      setFactor("");
      setIndEsperado("");
      setIndCobrado("");
      setIndAplicado("");
      setCobVsApl("");
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
          {!isAdmin && (
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
        {mensaje && <p className="alert success">{mensaje}</p>}
        {error && <p className="alert error">{error}</p>}
        {!isAdmin ? null : (
          <>
        <div className="placeholder-card">
          <p>Selecciona uno o varios archivos CSV con el formato esperado para cargar pedidos.</p>
        </div>
        <div className="tabla-wrapper">
          <div className="tabla-toolbar">
            <div className="tabla-header">Pedidos del proyecto</div>
            <button className="btn btn-primary" onClick={exportarExplosion} disabled={pedidos.length === 0}>
              Generar explosión de insumos
            </button>
          </div>
          {cargandoPedidos ? (
            <p>Cargando...</p>
          ) : pedidos.length === 0 ? (
            <p>No hay pedidos aun.</p>
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
                {pedidos.map((p) => (
                  <tr key={p.id}>
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
          </>
        )}

        {(!isAdmin && formCobranzaAbierto) && (
          <div className="placeholder-card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Nueva cobranza</h3>
            <form onSubmit={submitCobranza} className="form-cobranza">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input className="filter-select" type="text" value={control} onChange={(e) => setControl(e.target.value)} placeholder="Control (ej. 00431)" required />
                <input className="filter-select" type="date" value={fcReporte} onChange={(e) => setFcReporte(e.target.value)} title="Fecha reporte" />
                <input className="filter-select" type="date" value={fcFactura} onChange={(e) => setFcFactura(e.target.value)} placeholder="Fecha factura" />
                <input className="filter-select" type="text" value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="No. factura" />
                <input className="filter-select" type="number" step="0.01" value={impContratado} onChange={(e) => setImpContratado(e.target.value)} placeholder="Importe contratado" />
                <input className="filter-select" type="number" step="0.01" value={impCobrado} onChange={(e) => setImpCobrado(e.target.value)} placeholder="Importe cobrado" />
                <input className="filter-select" type="number" step="0.01" value={impACobrar} onChange={(e) => setImpACobrar(e.target.value)} placeholder="Importe a cobrar" />
                <input className="filter-select" type="number" step="0.01" value={fondoGarantia} onChange={(e) => setFondoGarantia(e.target.value)} placeholder="Fondo garantía" />
                <input className="filter-select" type="number" step="0.01" value={liqPorCobrar} onChange={(e) => setLiqPorCobrar(e.target.value)} placeholder="Líquido por cobrar" />
                <input className="filter-select" type="number" step="0.01" value={facturasPorCobrar} onChange={(e) => setFacturasPorCobrar(e.target.value)} placeholder="Facturas por cobrar" />
                <input className="filter-select" type="number" step="0.01" value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="Factor (%)" />
                <input className="filter-select" type="number" step="0.01" value={indEsperado} onChange={(e) => setIndEsperado(e.target.value)} placeholder="Indirectos esperado" />
                <input className="filter-select" type="number" step="0.01" value={indCobrado} onChange={(e) => setIndCobrado(e.target.value)} placeholder="Indirectos cobrado" />
                <input className="filter-select" type="number" step="0.01" value={indAplicado} onChange={(e) => setIndAplicado(e.target.value)} placeholder="Indirectos aplicado" />
                <input className="filter-select" type="number" step="0.01" value={cobVsApl} onChange={(e) => setCobVsApl(e.target.value)} placeholder="Cobrado vs aplicado" />
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setFormCobranzaAbierto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar cobranza</button>
              </div>
            </form>
          </div>
        )}

        <div className="tabla-wrapper" style={{ marginTop: 16 }}>
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
                  <th>Control</th>
                  <th>No. factura</th>
                  <th>Fecha factura</th>
                  <th style={{ textAlign: 'right' }}>Importe contratado</th>
                  <th style={{ textAlign: 'right' }}>Importe cobrado</th>
                  <th style={{ textAlign: 'right' }}>Importe a cobrar</th>
                  <th style={{ textAlign: 'right' }}>Fondo garantía</th>
                  <th style={{ textAlign: 'right' }}>Líquido por cobrar</th>
                  <th style={{ textAlign: 'right' }}>Facturas por cobrar</th>
                  <th style={{ textAlign: 'right' }}>Factor</th>
                </tr>
              </thead>
              <tbody>
                {cobranzas.map(c => (
                  <tr key={c.id_cobranza}>
                    <td>{c.control}</td>
                    <td>{c.numero_factura || '-'}</td>
                    <td>{c.fecha_factura || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.importe_contratado || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.importe_cobrado || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.importe_a_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.fondo_garantia || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.liquido_por_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.facturas_por_cobrar || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'right' }}>{Number(c.factor || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
