import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string | null;
  importe: number;
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

const formatCurrency = (value: number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null);
  const [detallesPedido, setDetallesPedido] = useState<PedidoDetalleItem[]>([]);
  const [cargandoDetalles, setCargandoDetalles] = useState(false);
  const [detalleError, setDetalleError] = useState("");
  const totalDetalles = useMemo(
    () => detallesPedido.reduce((sum, det) => sum + Number(det.importe || 0), 0),
    [detallesPedido]
  );

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

  const cerrarModalDetalles = useCallback(() => {
    setPedidoSeleccionado(null);
    setDetallesPedido([]);
    setDetalleError("");
  }, []);

  const abrirDetallesPedido = (pedido: Pedido) => {
    setPedidoSeleccionado(pedido);
    setDetallesPedido([]);
    setDetalleError("");
    setCargandoDetalles(true);
    const cargar = async () => {
      try {
        const res = await fetch(`http://localhost:3000/pedidos/${pedido.id}/detalles`, { headers: { ...authHeader() } });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.success) {
          const parsed: PedidoDetalleItem[] = (Array.isArray(data.data) ? data.data : []).map((det: any, index: number) => {
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

  useEffect(() => {
    if (!isTokenValid(getToken())) { navigate("/"); return; }
    if (isAdmin) {
      cargarPedidos();
    }
    cargarCobranza();
  }, [cargarPedidos, cargarCobranza, navigate, isAdmin]);

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

  const submitCobranza = async (e: React.FormEvent) => {
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
                {pedidos.map((p) => (
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
                <button type="button" className="btn btn-secondary" onClick={cerrarModalDetalles}>
                  Cerrar
                </button>
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
              ) : detallesPedido.length === 0 ? (
                <p className="pedido-modal-status">Este pedido no tiene detalles registrados.</p>
              ) : (
                <>
                  <div className="pedido-detalle-ledger">
                    <div className="pedido-detalle-table-wrapper">
                      <table className="pedido-detalle-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Descripción</th>
                            <th>Unidad</th>
                            <th>Medida</th>
                            <th>Cantidad</th>
                            <th>P. Unitario</th>
                            <th>Importe</th>
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
                              <td>{detalle.descripcion || "-"}</td>
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
                    </div>
                    <div className="pedido-detalle-summary">
                      <div className="pedido-detalle-summary-cell">
                        <span>Importe</span>
                        <strong>{formatCurrency(totalDetalles || 0)}</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>Descuento</span>
                        <strong>-</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>Subtotal</span>
                        <strong>{formatCurrency(totalDetalles || 0)}</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell">
                        <span>IVA</span>
                        <strong>-</strong>
                      </div>
                      <div className="pedido-detalle-summary-cell total">
                        <span>Total</span>
                        <strong>{formatCurrency(totalDetalles || 0)}</strong>
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

        {(!isAdmin && formCobranzaAbierto) && (
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
      </main>
    </div>
  );
}
