import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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
  const [familia, setFamilia] = useState<string>("");
  const [familias, setFamilias] = useState<string[]>([]);

  const nombreProyecto = state?.nombre || "Proyecto";

  const abrirExplorador = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const normalizarFecha = (valor: string) => {
    const v = valor.trim();
    // Soportar dd/mm/yyyy -> yyyy-mm-dd, si no, devolver tal cual
    const m = v.match(/^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return v; // fallback
  };

  const parseCsv = (text: string): PedidoCsv[] => {
    const rows = text
      .split(/\r?/)
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    if (rows.length < 2) return [];

    const headers = rows[0]
      .split(",")
      .map((h) => h.trim().toUpperCase());

    const idx = (name: string) => headers.indexOf(name);

    const iProyecto = idx("PROYECTO");
    const iPedido = idx("PEDIDO");
    const iClan = idx("CLAN");
    const iFamilia = idx("FAMILIA");
    const iProveedor = idx("PROVEEDOR");
    const iFecha = idx("FECHA DE APROBACION");
    const iConcepto = idx("CONCEPTO");
    // El CSV trae "SITUACIONES ESPECIALES " con espacio, normalizamos
    const iSitEsp = (() => {
      const i1 = headers.indexOf("SITUACIONES ESPECIALES");
      if (i1 >= 0) return i1;
      return headers.indexOf("SITUACIONES ESPECIALES ");
    })();
    const iImporte = idx("IMPORTE");

    const pedidos: PedidoCsv[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r].split(",");
      if (cols.length < 5) continue;
      const pedido: PedidoCsv = {
        nombre_proyecto: (cols[iProyecto] || nombreProyecto || "").trim(),
        pedido: (cols[iPedido] || "").trim(),
        clan: (cols[iClan] || "").trim(),
        familia: (cols[iFamilia] || "").trim(),
        proveedor: (cols[iProveedor] || "").trim(),
        fecha_aprobacion: normalizarFecha(cols[iFecha] || ""),
        concepto: (cols[iConcepto] || "").trim(),
        situaciones_especiales: (cols[iSitEsp] || "").trim(),
        importe: Number((cols[iImporte] || "0").toString().replace(/\s/g, "")),
      };
      pedidos.push(pedido);
    }
    return pedidos;
  };

  const onFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setMensaje("");
    setError("");
    try {
      const text = await file.text();
      const pedidos = parseCsv(text);
      if (!pedidos.length) {
        setError("No se encontraron filas válidas en el CSV");
        return;
      }
      setSubiendo(true);
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidos }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Error al subir pedidos");
      } else {
        setMensaje(data?.message || "Pedidos cargados correctamente");
        // recargar lista
        await cargarPedidos();
      }
    } catch (err) {
      setError("No se pudo leer el archivo CSV");
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const volver = useCallback(() => navigate("/home"), [navigate]);

  const cargarPedidos = useCallback(async (filtroFamilia?: string) => { 
    if (!id) return;
    setCargandoPedidos(true);
    try {
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos` + (filtroFamilia && filtroFamilia !== "" ? `?familia=${encodeURIComponent(filtroFamilia)}` : ""));
      const data = await res.json();
      if (res.ok && data?.success) {
        setPedidos(data.data as Pedido[]);
      } else {
        setError(data?.message || "Error cargando pedidos");
      }
    } catch (e) {
      setError("Error de conexión al cargar pedidos");
    } finally {
      setCargandoPedidos(false);
    }
   } , [id]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  // Construir catálogo de familias a partir de los pedidos cargados
  useEffect(() => {
    const unique = Array.from(new Set(pedidos.map((p) => p.familia)))
      .filter(Boolean)
      .sort();
    setFamilias(unique);
  }, [pedidos]);

  const exportarExplosion = useCallback(async () => {
    try {
      if (!id) return;
      const qs = familia && familia !== "" ? `?familia=${encodeURIComponent(familia)}` : "";
      const res = await fetch(`http://localhost:3000/proyectos/${id}/pedidos/export${qs}`);
      if (!res.ok) {
        setError("No se pudo generar el archivo");
        return;
      }
      // Obtener nombre de archivo del header si existe
      const cd = res.headers.get("Content-Disposition") || "";
      let serverFilename = "";
      const m = cd.match(/filename\s*=\s*"?([^";]+)"?/i);
      if (m) serverFilename = m[1];
      // Fecha local para componer el nombre si el servidor no lo envía
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const famSlug = familia && familia !== "" ? `_${familia.replace(/[^A-Za-z0-9_-]+/g, "-")}` : "";
      a.download = serverFilename || "explosion_insumos_proyecto_${nombreProyecto}${famSlug}_${today}.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Error de conexión al generar exportación");
    }
  }, [id, familia]);

  return (
    <div className="detalle-page">
      <header className="detalle-header">
        <button className="btn btn-secondary" onClick={volver}>&larr; Regresar</button>
        <h2 className="detalle-titulo">{nombreProyecto}</h2>
        <div className="detalle-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={onFileSelected}
          />
          <button className="btn btn-primary" onClick={abrirExplorador} disabled={subiendo}>
            {subiendo ? "Subiendo..." : "Agregar pedido"}
          </button>
          <select
            className="filter-select"
            value={familia}
            onChange={(e) => {
              const val = e.target.value;
              setFamilia(val);
              cargarPedidos(val || undefined);
            }}
          >
            <option value="">Todas las familias</option>
            {familias.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={exportarExplosion} disabled={pedidos.length === 0}>
            Generar explosión de insumos
          </button>
        </div>
      </header>

      <main className="detalle-contenido">
        {mensaje && <p className="alert success">{mensaje}</p>}
        {error && <p className="alert error">{error}</p>}
        <div className="placeholder-card">
          <p>Selecciona un archivo CSV con el formato esperado para cargar pedidos.</p>
        </div>
        <div className="tabla-wrapper">
          <div className="tabla-header">Pedidos del proyecto</div>
          {cargandoPedidos ? (
            <p>Cargando...</p>
          ) : pedidos.length === 0 ? (
            <p>No hay pedidos aún.</p>
          ) : (
            <table className="tabla-pedidos">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Clan</th>
                  <th>Familia</th>
                  <th>Proveedor</th>
                  <th>Fecha Aprobación</th>
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
      </main>
    </div>
  );
}



