import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';
import API_URL from '../../config';

interface PresupuestoData {
  proyecto: {
    id: number;
    nombre: string;
  };
  kpis: {
    presupuestoTotal: number;
    presupuestoEjecutado: number;
    presupuestoDisponible: number;
    eficienciaGasto: number;
  };
  distribucionCategoria: Array<{
    categoria: string;
    presupuesto: number;
    gastado: number;
  }>;
  historialPresupuesto: Array<{
    fecha: string;
    presupuesto: number;
    motivo: string;
  }>;
  pedidosCostosos: Array<{
    id: number;
    concepto: string;
    proveedor: string;
    importe: number;
    fecha: string;
  }>;
}

export const DashboardPresupuestos: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PresupuestoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || isNaN(Number(projectId))) {
      navigate('/dashboards');
      return;
    }
    fetchPresupuestoData();
  }, [projectId, navigate]);

  const fetchPresupuestoData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/dashboard/proyecto/${projectId}/presupuestos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else if (response.status === 404) {
        navigate('/dashboards');
      }
    } catch (error) {
      console.error('Error fetching presupuesto data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-loading">Cargando dashboard...</div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="dashboard-error">Error al cargar los datos</div>
      </DashboardLayout>
    );
  }

  const porcentajeEjecutado = data.kpis.presupuestoTotal > 0
    ? ((data.kpis.presupuestoEjecutado / data.kpis.presupuestoTotal) * 100).toFixed(1)
    : '0';

  const porcentajeDisponible = data.kpis.presupuestoTotal > 0
    ? ((data.kpis.presupuestoDisponible / data.kpis.presupuestoTotal) * 100).toFixed(1)
    : '0';

  // Preparar datos para el pie chart
  const pieData = data.distribucionCategoria
    .filter(cat => cat.presupuesto > 0)
    .map(cat => ({
      categoria: cat.categoria,
      monto: cat.presupuesto
    }));

  return (
    <DashboardLayout projectName={data.proyecto.nombre}>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard de Presupuestos</h1>
          <p className="dashboard-subtitle">Análisis financiero y control presupuestal del proyecto</p>
        </div>

        <div className="kpi-grid">
          <KPICard
            title="Presupuesto Total"
            value={formatCurrency(data.kpis.presupuestoTotal)}
            color="#3b82f6"
          />
          <KPICard
            title="Presupuesto Ejecutado"
            value={formatCurrency(data.kpis.presupuestoEjecutado)}
            subtitle={`${porcentajeEjecutado}% del total`}
            color="#ef4444"
          />
          <KPICard
            title="Presupuesto Disponible"
            value={formatCurrency(data.kpis.presupuestoDisponible)}
            subtitle={`${porcentajeDisponible}% restante`}
            color={data.kpis.presupuestoDisponible < 0 ? '#ef4444' : '#10b981'}
          />
          <KPICard
            title="Eficiencia de Gasto"
            value={`${data.kpis.eficienciaGasto.toFixed(1)}%`}
            color="#8b5cf6"
          />
        </div>

        <div className="charts-grid">
          {pieData.length > 0 && (
            <div className="chart-item">
              <PieChart
                data={pieData}
                dataKey="monto"
                nameKey="categoria"
                title="Distribución Presupuestal por Categoría"
                height={350}
                colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']}
              />
            </div>
          )}

          <div className="chart-item">
            <div className="chart-container">
              <h3 className="chart-title">Presupuesto vs Gastado por Categoría</h3>
              <div className="category-comparison">
                {data.distribucionCategoria.map((cat, index) => {
                  const porcentaje = cat.presupuesto > 0
                    ? (cat.gastado / cat.presupuesto) * 100
                    : 0;
                  return (
                    <div key={index} className="category-row">
                      <div className="category-header">
                        <span className="category-name">{cat.categoria}</span>
                        <span className="category-values">
                          {formatCurrency(cat.gastado)} / {formatCurrency(cat.presupuesto)}
                        </span>
                      </div>
                      <div className="category-progress">
                        <div
                          className={`category-progress-bar ${porcentaje > 100 ? 'danger' : porcentaje > 80 ? 'warning' : ''}`}
                          style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        />
                      </div>
                      <span className="category-percentage">{porcentaje.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="chart-item chart-full-width">
            <div className="chart-container">
              <h3 className="chart-title">Pedidos más Costosos</h3>
              <div className="budget-comparison-table">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Proveedor</th>
                      <th>Importe</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pedidosCostosos.map((pedido, index) => (
                      <tr key={index}>
                        <td>{pedido.concepto}</td>
                        <td>{pedido.proveedor || '-'}</td>
                        <td className="text-right">{formatCurrency(pedido.importe)}</td>
                        <td>{formatDate(pedido.fecha)}</td>
                      </tr>
                    ))}
                    {data.pedidosCostosos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center">No hay pedidos registrados</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {data.historialPresupuesto.length > 0 && (
          <div className="budget-summary">
            <h3>Historial de Cambios de Presupuesto</h3>
            <div className="history-list">
              {data.historialPresupuesto.map((item, index) => (
                <div key={index} className="history-item">
                  <div className="history-date">{formatDate(item.fecha)}</div>
                  <div className="history-amount">{formatCurrency(item.presupuesto)}</div>
                  <div className="history-reason">{item.motivo || 'Sin motivo especificado'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
