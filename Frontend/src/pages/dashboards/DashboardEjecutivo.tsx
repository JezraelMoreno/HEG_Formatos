import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface DashboardData {
  proyecto: {
    id: number;
    nombre: string;
    estado: string;
    fechaProyecto: string;
  };
  kpis: {
    presupuestoTotal: number;
    presupuestoEjecutado: number;
    presupuestoDisponible: number;
    porcentajeEjecutado: number;
  };
  distribucionCategoria: Array<{ categoria: string; monto: number }>;
  gastosMensuales: Array<{ mes: string; gasto: number }>;
  pedidosPorConcepto: Array<{ concepto: string; cantidad: number; total: number }>;
}

export const DashboardEjecutivo: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || isNaN(Number(projectId))) {
      navigate('/dashboards');
      return;
    }
    fetchDashboardData();
  }, [projectId, navigate]);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/dashboard/proyecto/${projectId}/ejecutivo`, {
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
      console.error('Error fetching dashboard data:', error);
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

  const porcentajeEjecutado = data.kpis.porcentajeEjecutado;

  return (
    <DashboardLayout projectName={data.proyecto.nombre}>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard Ejecutivo</h1>
          <p className="dashboard-subtitle">
            Vista general del proyecto - Estado: <span className={`status-badge ${data.proyecto.estado === 'En Progreso' ? 'en-progreso' : 'completado'}`}>{data.proyecto.estado}</span>
          </p>
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
            subtitle={`${porcentajeEjecutado.toFixed(1)}% del total`}
            color="#f59e0b"
          />
          <KPICard
            title="Presupuesto Disponible"
            value={formatCurrency(data.kpis.presupuestoDisponible)}
            color={data.kpis.presupuestoDisponible < 0 ? '#ef4444' : '#10b981'}
          />
        </div>

        <div className="charts-grid">
          {data.distribucionCategoria.length > 0 && (
            <div className="chart-item">
              <PieChart
                data={data.distribucionCategoria}
                dataKey="monto"
                nameKey="categoria"
                title="Distribución por Categoría"
                height={350}
              />
            </div>
          )}

          {data.pedidosPorConcepto.length > 0 && (
            <div className="chart-item">
              <BarChart
                data={data.pedidosPorConcepto}
                dataKey="total"
                xAxisKey="concepto"
                title="Gastos por Concepto"
                color="#10b981"
                height={350}
              />
            </div>
          )}

          {data.gastosMensuales.length > 0 && (
            <div className="chart-item chart-full-width">
              <LineChart
                data={data.gastosMensuales}
                dataKey="gasto"
                xAxisKey="mes"
                title="Tendencia de Gastos Mensuales"
                color="#3b82f6"
                height={350}
              />
            </div>
          )}
        </div>

        <div className="dashboard-alerts">
          <h3>Alertas y Notificaciones</h3>
          <div className="alerts-container">
            {porcentajeEjecutado > 100 && (
              <div className="alert alert-danger">
                El presupuesto ejecutado ha superado el 100% del presupuesto asignado
              </div>
            )}
            {porcentajeEjecutado > 80 && porcentajeEjecutado <= 100 && (
              <div className="alert alert-warning">
                El presupuesto ejecutado ha superado el 80% del presupuesto total
              </div>
            )}
            {porcentajeEjecutado <= 50 && (
              <div className="alert alert-success">
                El proyecto tiene un buen margen de presupuesto disponible
              </div>
            )}
            {data.kpis.presupuestoDisponible < 0 && (
              <div className="alert alert-danger">
                El proyecto tiene un déficit de {formatCurrency(Math.abs(data.kpis.presupuestoDisponible))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
