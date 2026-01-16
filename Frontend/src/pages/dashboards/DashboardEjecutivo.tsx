import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface DashboardData {
  kpis: {
    totalProyectos: number;
    proyectosActivos: number;
    presupuestoTotal: number;
    presupuestoEjecutado: number;
  };
  proyectosPorEstado: Array<{ estado: string; cantidad: number }>;
  tendenciaPresupuesto: Array<{ mes: string; presupuesto: number }>;
  proyectosCompletados: Array<{ mes: string; cantidad: number }>;
}

export const DashboardEjecutivo: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/dashboard/ejecutivo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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

  return (
    <DashboardLayout>
      <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard Ejecutivo</h1>
        <p className="dashboard-subtitle">Vista general del sistema de proyectos</p>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Total de Proyectos"
          value={data.kpis.totalProyectos}
          color="#3b82f6"
        />
        <KPICard
          title="Proyectos Activos"
          value={data.kpis.proyectosActivos}
          color="#10b981"
        />
        <KPICard
          title="Presupuesto Total"
          value={`$${data.kpis.presupuestoTotal.toLocaleString()}`}
          color="#f59e0b"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <PieChart
            data={data.proyectosPorEstado}
            dataKey="cantidad"
            nameKey="estado"
            title="Distribución de Proyectos por Estado"
            height={350}
          />
        </div>

        <div className="chart-item">
          <BarChart
            data={data.proyectosCompletados}
            dataKey="cantidad"
            xAxisKey="mes"
            title="Proyectos Completados por Mes"
            color="#10b981"
            height={350}
          />
        </div>

        <div className="chart-item chart-full-width">
          <LineChart
            data={data.tendenciaPresupuesto}
            dataKey="presupuesto"
            xAxisKey="mes"
            title="Tendencia de Presupuesto Mensual"
            color="#3b82f6"
            height={350}
          />
        </div>
      </div>

      <div className="dashboard-alerts">
        <h3>Alertas y Notificaciones</h3>
        <div className="alerts-container">
          {data.kpis.presupuestoTotal > 0 && (data.kpis.presupuestoEjecutado / data.kpis.presupuestoTotal) > 0.8 && (
            <div className="alert alert-warning">
              El presupuesto ejecutado ha superado el 80% del presupuesto total
            </div>
          )}
          {data.kpis.proyectosActivos === 0 && (
            <div className="alert alert-info">
              No hay proyectos activos en este momento
            </div>
          )}
          {data.kpis.proyectosActivos > 10 && (
            <div className="alert alert-success">
              Hay {data.kpis.proyectosActivos} proyectos activos en curso
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
};
