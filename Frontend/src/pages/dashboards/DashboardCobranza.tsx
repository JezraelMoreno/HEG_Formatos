import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import API_URL from '../../config';
import { KPICard } from '../../components/charts/KPICard';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface CobranzaResumen {
  id_proyecto: number;
  nombre_proyecto: string;
  codigo_control: string;
  importe_contratado: number;
  importe_cobrado: number;
  importe_a_cobrar: number;
  fondo_garantia: number;
  liquido_por_cobrar: number;
  aplicado: number;
  cobrado_vs_aplicado: number;
  factor_indirectos: number;
  indirectos_aplicados: number;
  indirectos_esperado: number;
  indirectos_cobrado: number;
  indirectos_cobrado_vs_aplicado: number;
}

interface Factura {
  id_factura: number;
  numero_factura: string;
  fecha_factura: string;
  importe_factura: number;
  importe_cobrado: number;
  saldo_por_cobrar: number;
  fecha_cobro: string | null;
  observaciones: string;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const DashboardCobranza: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [resumen, setResumen] = useState<CobranzaResumen | null>(null);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCobranzaData = useCallback(async () => {
    if (!projectId || isNaN(Number(projectId))) {
      navigate('/dashboards');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch resumen de cobranza
      const resumenResponse = await fetch(`${API_URL}/proyectos/${projectId}/cobranza-resumen`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Fetch facturas
      const facturasResponse = await fetch(`${API_URL}/proyectos/${projectId}/cobranza-facturas`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resumenResponse.ok) {
        const resumenData = await resumenResponse.json();
        if (resumenData.success) {
          setResumen(resumenData.data);
        }
      } else if (resumenResponse.status === 404) {
        navigate('/dashboards');
        return;
      }

      if (facturasResponse.ok) {
        const facturasData = await facturasResponse.json();
        if (facturasData.success) {
          setFacturas(facturasData.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching cobranza data:', err);
      setError('Error al cargar los datos de cobranza');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    fetchCobranzaData();
  }, [fetchCobranzaData]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-loading">Cargando cobranza del proyecto...</div>
      </DashboardLayout>
    );
  }

  if (error && !resumen) {
    return (
      <DashboardLayout>
        <div className="dashboard-error">{error}</div>
      </DashboardLayout>
    );
  }

  if (!resumen) {
    return (
      <DashboardLayout>
        <div className="dashboard-error">No se encontraron datos de cobranza para este proyecto</div>
      </DashboardLayout>
    );
  }

  const porcentajeCobrado = resumen.importe_contratado > 0
    ? ((resumen.importe_cobrado / resumen.importe_contratado) * 100).toFixed(1)
    : '0';

  const enRojo = resumen.cobrado_vs_aplicado < 0;
  const indirectosEnRojo = resumen.indirectos_cobrado_vs_aplicado < 0;

  // Datos para el pie chart
  const pieData = [
    { nombre: 'Cobrado', valor: resumen.importe_cobrado },
    { nombre: 'Por Cobrar', valor: resumen.importe_a_cobrar },
    { nombre: 'Fondo Garantía', valor: resumen.fondo_garantia }
  ].filter(item => item.valor > 0);

  return (
    <DashboardLayout projectName={resumen.nombre_proyecto}>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1>Dashboard de Cobranza</h1>
            <p className="dashboard-subtitle">
              Control de cobranza del proyecto
              {resumen.codigo_control && ` - Control: ${resumen.codigo_control}`}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <KPICard
            title="Importe Contratado"
            value={formatCurrency(resumen.importe_contratado)}
            color="#3b82f6"
          />
          <KPICard
            title="Importe Cobrado"
            value={formatCurrency(resumen.importe_cobrado)}
            subtitle={`${porcentajeCobrado}% del contratado`}
            color="#10b981"
          />
          <KPICard
            title="Líquido por Cobrar"
            value={formatCurrency(resumen.liquido_por_cobrar)}
            color="#f59e0b"
          />
          <KPICard
            title="Cobrado vs Aplicado"
            value={formatCurrency(resumen.cobrado_vs_aplicado)}
            subtitle={enRojo ? 'En números rojos' : 'Positivo'}
            color={enRojo ? '#ef4444' : '#10b981'}
          />
        </div>

        <div className="charts-grid">
          {pieData.length > 0 && (
            <div className="chart-item">
              <PieChart
                data={pieData}
                dataKey="valor"
                nameKey="nombre"
                title="Distribución de Cobranza"
                height={350}
                colors={['#10b981', '#f59e0b', '#8b5cf6']}
              />
            </div>
          )}

          <div className="chart-item">
            <div className="chart-container">
              <h3 className="chart-title">Resumen de Cobranza</h3>
              <div className="cobranza-resumen-detalle">
                <div className="resumen-row">
                  <span className="resumen-label">Importe Contratado:</span>
                  <span className="resumen-value">{formatCurrency(resumen.importe_contratado)}</span>
                </div>
                <div className="resumen-row">
                  <span className="resumen-label">Importe Cobrado:</span>
                  <span className="resumen-value">{formatCurrency(resumen.importe_cobrado)}</span>
                </div>
                <div className="resumen-row">
                  <span className="resumen-label">Importe por Cobrar:</span>
                  <span className="resumen-value">{formatCurrency(resumen.importe_a_cobrar)}</span>
                </div>
                <div className="resumen-row">
                  <span className="resumen-label">Fondo de Garantía:</span>
                  <span className="resumen-value">{formatCurrency(resumen.fondo_garantia)}</span>
                </div>
                <div className="resumen-row">
                  <span className="resumen-label">Líquido por Cobrar:</span>
                  <span className="resumen-value">{formatCurrency(resumen.liquido_por_cobrar)}</span>
                </div>
                <div className="resumen-row highlight">
                  <span className="resumen-label">Aplicado (Gastos):</span>
                  <span className="resumen-value">{formatCurrency(resumen.aplicado)}</span>
                </div>
                <div className={`resumen-row ${enRojo ? 'danger' : 'success'}`}>
                  <span className="resumen-label"><strong>Cobrado vs Aplicado:</strong></span>
                  <span className="resumen-value"><strong>{formatCurrency(resumen.cobrado_vs_aplicado)}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sección de Indirectos */}
        <div className="indirectos-section">
          <h3>Indirectos</h3>
          <div className="indirectos-grid">
            <div className="indirecto-card">
              <span className="indirecto-label">Factor</span>
              <span className="indirecto-value">{(resumen.factor_indirectos * 100).toFixed(0)}%</span>
            </div>
            <div className="indirecto-card">
              <span className="indirecto-label">Esperado</span>
              <span className="indirecto-value">{formatCurrency(resumen.indirectos_esperado)}</span>
            </div>
            <div className="indirecto-card">
              <span className="indirecto-label">Cobrado</span>
              <span className="indirecto-value">{formatCurrency(resumen.indirectos_cobrado)}</span>
            </div>
            <div className="indirecto-card">
              <span className="indirecto-label">Aplicado</span>
              <span className="indirecto-value">{formatCurrency(resumen.indirectos_aplicados)}</span>
            </div>
            <div className={`indirecto-card ${indirectosEnRojo ? 'danger' : 'success'}`}>
              <span className="indirecto-label">Cob. vs Apl.</span>
              <span className="indirecto-value">{formatCurrency(resumen.indirectos_cobrado_vs_aplicado)}</span>
            </div>
          </div>
        </div>

        {/* Tabla de Facturas */}
        <div className="materials-projection-section">
          <h3>Facturas del Proyecto</h3>
          <div className="materials-table">
            <table>
              <thead>
                <tr>
                  <th>No. Factura</th>
                  <th>Fecha Factura</th>
                  <th className="text-right">Importe</th>
                  <th className="text-right">Cobrado</th>
                  <th className="text-right">Saldo</th>
                  <th>Fecha Cobro</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.length > 0 ? (
                  facturas.map((factura) => (
                    <tr key={factura.id_factura}>
                      <td>{factura.numero_factura || '-'}</td>
                      <td>{formatDate(factura.fecha_factura)}</td>
                      <td className="text-right">{formatCurrency(factura.importe_factura)}</td>
                      <td className="text-right">{formatCurrency(factura.importe_cobrado)}</td>
                      <td className={`text-right ${factura.saldo_por_cobrar > 0 ? 'valor-pendiente' : ''}`}>
                        {formatCurrency(factura.saldo_por_cobrar)}
                      </td>
                      <td>{formatDate(factura.fecha_cobro)}</td>
                      <td>{factura.observaciones || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No hay facturas registradas para este proyecto
                    </td>
                  </tr>
                )}
              </tbody>
              {facturas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>TOTALES</strong></td>
                    <td className="text-right">
                      <strong>{formatCurrency(facturas.reduce((sum, f) => sum + f.importe_factura, 0))}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{formatCurrency(facturas.reduce((sum, f) => sum + f.importe_cobrado, 0))}</strong>
                    </td>
                    <td className="text-right">
                      <strong>{formatCurrency(facturas.reduce((sum, f) => sum + f.saldo_por_cobrar, 0))}</strong>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Alerta si está en rojo */}
        {enRojo && (
          <div className="alerta-proyectos-rojo">
            <h3>Proyecto en números rojos</h3>
            <p>
              Este proyecto tiene más gastos aplicados ({formatCurrency(resumen.aplicado)})
              que cobranza recibida ({formatCurrency(resumen.importe_cobrado)}).
              Diferencia: {formatCurrency(resumen.cobrado_vs_aplicado)}
            </p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
