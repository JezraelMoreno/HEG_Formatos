import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { BackButton } from "../components/BackButton";
import { authHeader } from "../auth";
import API_URL from "../config";
import hegLogo from "../../assets/heg_logo.jpg";
import "./pedidoPreview.css";

type PedidoPreviewData = {
  id: number;
  id_proyecto?: number;
  nombre_proyecto?: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  nombre_usuario?: string | null;
  fecha_aprobacion: string;
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

type DetalleUnion = PedidoDetalleItem | PedidoDetalleCristalItem | PedidoDetalleAluminioItem;

type PreviewLocationState = {
  pedido?: PedidoPreviewData;
  detalles?: DetalleUnion[];
  tipoDetalle?: "miscelaneos" | "cristal" | "aluminio";
  proyectoNombre?: string;
};

const formatCurrency = (value: number | null | undefined) => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `$${safe.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatFechaLarga = (iso: string | null | undefined) => {
  if (!iso) return "Cd. de México";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Cd. de México";
  const fmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return `Cd. de México a ${fmt.format(date)}`;
};

const normalizarFamilia = (familia: string | null | undefined) => (familia || "").trim().toUpperCase();

export function PedidoPreview() {
  const { id, pedidoId } = useParams();
  const { state } = useLocation() as { state?: PreviewLocationState };
  const pedidoIdNumero = Number(pedidoId);
  const [pedido, setPedido] = useState<PedidoPreviewData | null>(() => state?.pedido || null);
  const [detalles, setDetalles] = useState<DetalleUnion[]>(() => state?.detalles || []);
  const [tipoDetalle, setTipoDetalle] = useState<"miscelaneos" | "cristal" | "aluminio">(
    () => state?.tipoDetalle || "miscelaneos"
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const porcentajeDescuento = useMemo(() => {
    if (!pedido) return 0;
    let pct = Number(pedido.porcentaje_descuento ?? 0);
    if (!Number.isFinite(pct) || pct <= 0) return 0;
    if (pct > 0 && pct <= 1) pct = pct * 100;
    return pct;
  }, [pedido]);

  const subtotalBase = useMemo(
    () => detalles.reduce((sum, det) => sum + Number((det as any).importe || 0), 0),
    [detalles]
  );
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
  const proyectoNombre = pedido?.nombre_proyecto || state?.proyectoNombre || "Proyecto";
  const formuladoPor = (pedido?.nombre_usuario || "").trim() || "No capturado";

  useEffect(() => {
    const needsPedido = !pedido;
    const needsDetalles = detalles.length === 0;
    if (!id || !pedidoIdNumero || (!needsPedido && !needsDetalles)) return;
    const cargar = async () => {
      setCargando(true);
      setError("");
      try {
        let pedidoEncontrado = pedido;
        if (needsPedido) {
          const res = await fetch(`${API_URL}/proyectos/${id}/pedidos`, { headers: { ...authHeader() } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.success || !Array.isArray(data.data)) {
            throw new Error(data?.message || "No se pudo obtener el pedido");
          }
          pedidoEncontrado = data.data.find((p: any) => Number(p.id) === pedidoIdNumero) || null;
          setPedido(pedidoEncontrado);
        }
        const familia = normalizarFamilia(pedidoEncontrado?.familia);
        const endpoint = familia === "CR" ? "detalles-cristal" : familia === "AL" || familia === "MQAL" ? "detalles-aluminio" : "detalles";
        if (familia === "CR") setTipoDetalle("cristal");
        else if (familia === "AL" || familia === "MQAL") setTipoDetalle("aluminio");
        else setTipoDetalle("miscelaneos");
        if (needsDetalles) {
          const resDetalles = await fetch(`${API_URL}/pedidos/${pedidoIdNumero}/${endpoint}`, { headers: { ...authHeader() } });
          const dataDetalles = await resDetalles.json().catch(() => ({}));
          if (!resDetalles.ok || !dataDetalles?.success || !Array.isArray(dataDetalles.data)) {
            throw new Error(dataDetalles?.message || "No se pudieron obtener los detalles");
          }
          setDetalles(dataDetalles.data);
        }
      } catch (e: any) {
        setError(e?.message || "No se pudo cargar la vista previa");
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [id, pedidoIdNumero, pedido, detalles.length]);

  const filasMiscelaneos = tipoDetalle === "miscelaneos"
    ? (detalles as PedidoDetalleItem[])
    : [];
  const filasCristal = tipoDetalle === "cristal"
    ? (detalles as PedidoDetalleCristalItem[])
    : [];
  const filasAluminio = tipoDetalle === "aluminio"
    ? (detalles as PedidoDetalleAluminioItem[])
    : [];

  return (
    <div className="preview-page">
      <div className="preview-toolbar">
        <BackButton />
        <div className="preview-toolbar-actions">
          <span className="preview-pill">{pedido ? `Pedido ${pedido.pedido}` : "Vista previa"}</span>
          <button className="btn btn-primary" onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>

      <div className="preview-sheet">
        <div className="sheet-grid-bg" aria-hidden="true" />
        <div className="preview-top">
          <div className="preview-logo">
            <img src={hegLogo} alt="Logo HEG" />
          </div>
          <div className="preview-top-info">
            <div className="preview-date">{formatFechaLarga(pedido?.fecha_aprobacion)}</div>
            <div className="preview-provider">
              <div className="provider-label">Proveedor:</div>
              <div className="provider-name">{pedido?.proveedor || "Proveedor no capturado"}</div>
              <div className="provider-meta">
                <span>Proyecto:</span>
                <strong>{proyectoNombre}</strong>
              </div>
              <div className="provider-meta">
                <span>Clan:</span>
                <strong>{pedido?.clan || "-"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="preview-company">HEG DISEÑO E INSTALACION, S.A. DE C.V.</div>

        <div className="preview-meta-grid">
          <div className="meta-table">
            <div className="meta-row">
              <span>PEDIDO</span>
              <strong>{pedido?.pedido || "-"}</strong>
            </div>
            <div className="meta-row">
              <span>FAMILIA</span>
              <strong>{normalizarFamilia(pedido?.familia) || "-"}</strong>
            </div>
            <div className="meta-row">
              <span>CONCEPTO</span>
              <strong>{pedido?.concepto || "-"}</strong>
            </div>
          </div>
          <div className="meta-table">
            <div className="meta-row">
              <span>PROYECTO</span>
              <strong>{proyectoNombre}</strong>
            </div>
            <div className="meta-row">
              <span>CLAN</span>
              <strong>{pedido?.clan || "-"}</strong>
            </div>
            <div className="meta-row">
              <span>ENTREGAR EN</span>
              <strong>{pedido?.situaciones_especiales || "Por definir"}</strong>
            </div>
          </div>
        </div>

        <div className="preview-descripciones">
          <h4>Descripciones</h4>
          <ul>
            {(tipoDetalle === "cristal"
              ? filasCristal
              : tipoDetalle === "aluminio"
                ? filasAluminio
                : filasMiscelaneos
            ).map((detalle, idx) => (
              <li key={`${detalle.id_detalle}-${idx}`}>
                <strong>{idx + 1}.</strong>{" "}
                {((detalle as any).descripcion || "").trim() || "-"}
              </li>
            ))}
          </ul>
        </div>
        <div className="preview-table-wrapper">
          {cargando ? (
            <p className="preview-status">Cargando vista previa...</p>
          ) : error ? (
            <p className="preview-status error">{error}</p>
          ) : tipoDetalle === "cristal" ? (
            <table className="preview-table">
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>CLAVE / MODELO</th>
                  <th>ANCHO</th>
                  <th>LARGO</th>
                  <th>M2 CORTE</th>
                  <th>PIEZAS</th>
                  <th>M2 PEDIDO</th>
                  <th>P. UNITARIO</th>
                  <th>IMPORTE</th>
                </tr>
              </thead>
              <tbody>
                {filasCristal.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="preview-empty">Sin detalles registrados</td>
                  </tr>
                ) : filasCristal.map((detalle, idx) => (
                  <tr key={`${detalle.id_detalle}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{detalle.clave_modelo || "-"}</td>
                    <td>{detalle.ancho === null || detalle.ancho === undefined ? "-" : Number(detalle.ancho).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.largo === null || detalle.largo === undefined ? "-" : Number(detalle.largo).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.m2_corte === null || detalle.m2_corte === undefined ? "-" : Number(detalle.m2_corte).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{Number(detalle.piezas || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>{detalle.m2_pedido === null || detalle.m2_pedido === undefined ? "-" : Number(detalle.m2_pedido).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{formatCurrency(detalle.precio_unitario)}</td>
                    <td>{formatCurrency(detalle.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tipoDetalle === "aluminio" ? (
            <table className="preview-table">
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>N° PERFIL</th>
                  <th>MEDIDA (TRAMO)</th>
                  <th>UNIDAD</th>
                  <th>PESO (KG/ML)</th>
                  <th>PERÍM (M2/ML)</th>
                  <th>ACABADO</th>
                  <th>TOTAL TRAMOS</th>
                  <th>M.L.</th>
                  <th>KG</th>
                  <th>M2</th>
                  <th>IMPORTE</th>
                </tr>
              </thead>
              <tbody>
                {filasAluminio.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="preview-empty">Sin detalles registrados</td>
                  </tr>
                ) : filasAluminio.map((detalle, idx) => (
                  <tr key={`${detalle.id_detalle}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{detalle.numero_perfil || "-"}</td>
                    <td>{detalle.medida_tramo === null || detalle.medida_tramo === undefined ? "-" : Number(detalle.medida_tramo).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.unidad || "-"}</td>
                    <td>{detalle.peso_kg_ml === null || detalle.peso_kg_ml === undefined ? "-" : Number(detalle.peso_kg_ml).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.perimetro_m2_ml === null || detalle.perimetro_m2_ml === undefined ? "-" : Number(detalle.perimetro_m2_ml).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.acabado || "-"}</td>
                    <td>{detalle.total_tramos === null || detalle.total_tramos === undefined ? "-" : Number(detalle.total_tramos).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>{detalle.ml === null || detalle.ml === undefined ? "-" : Number(detalle.ml).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.kg === null || detalle.kg === undefined ? "-" : Number(detalle.kg).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.m2 === null || detalle.m2 === undefined ? "-" : Number(detalle.m2).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{formatCurrency(detalle.importe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="preview-table">
              <thead>
                <tr>
                  <th>NO.</th>
                  <th>UNIDAD</th>
                  <th>MEDIDA</th>
                  <th>CANTIDAD</th>
                  <th>P. UNITARIO</th>
                  <th>IMPORTE</th>
                  <th>CLAVE</th>
                  <th>DIBUJO</th>
                  <th>M.L.</th>
                  <th>ACABADO</th>
                  <th>KG</th>
                  <th>PRECIOxKG</th>
                </tr>
              </thead>
              <tbody>
                {filasMiscelaneos.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="preview-empty">Sin detalles registrados</td>
                  </tr>
                ) : filasMiscelaneos.map((detalle, idx) => (
                  <tr key={`${detalle.id_detalle}-${idx}`}>
                    <td>{idx + 1}</td>
                    <td>{detalle.unidad || "-"}</td>
                    <td>{detalle.medida || "-"}</td>
                    <td>{Number(detalle.cantidad || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{formatCurrency(detalle.precio_unitario)}</td>
                    <td>{formatCurrency(detalle.importe)}</td>
                    <td>{detalle.clave || "-"}</td>
                    <td>-</td>
                    <td>{detalle.ml === null || detalle.ml === undefined ? "-" : Number(detalle.ml).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.acabado || "-"}</td>
                    <td>{detalle.kg === null || detalle.kg === undefined ? "-" : Number(detalle.kg).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td>{detalle.precio_x_kg === null || detalle.precio_x_kg === undefined ? "-" : formatCurrency(detalle.precio_x_kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="preview-payment-block">
          <div className="payment-title">PAGOS INMEDIATOS</div>
          <div className="payment-approved">APROBADO</div>
          <div className="payment-date">
            <span>FECHA DE APROBACIÓN</span>
            <strong>{pedido?.fecha_aprobacion || "-"}</strong>
          </div>
        </div>

        <div className="preview-totals">
          <div className="totals-table">
            <div className="totals-row">
              <span>IMPORTE</span>
              <strong>{formatCurrency(subtotalBase)}</strong>
            </div>
            <div className="totals-row">
              <span>DESCUENTO</span>
              <strong>
                {porcentajeDescuento > 0 ? `${formatCurrency(descuentoMonto)} (${porcentajeDescuento.toFixed(2)}%)` : "-"}
              </strong>
            </div>
            <div className="totals-row">
              <span>SUBTOTAL</span>
              <strong>{formatCurrency(subtotalConDescuento)}</strong>
            </div>
            <div className="totals-row">
              <span>IVA</span>
              <strong>{formatCurrency(ivaMonto)}</strong>
            </div>
            <div className="totals-row total">
              <span>TOTAL</span>
              <strong>{formatCurrency(totalFinal)}</strong>
            </div>
          </div>
          <div className="totals-special">
            <span>SITUACIONES ESPECIALES</span>
            <p>{pedido?.situaciones_especiales?.trim() || "-"}</p>
          </div>
        </div>

        <div className="preview-footer">
          <div className="footer-label">FORMULÓ</div>
          <div className="footer-value">{formuladoPor}</div>
        </div>
      </div>
    </div>
  );
}
