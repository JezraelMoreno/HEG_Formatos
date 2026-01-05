import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface PresupuestoData {
  kpis: {
    presupuestoTotal: number;
    presupuestoEjecutado: number;
    presupuestoDisponible: number;
    eficienciaGasto: number;
  };
  distribucionPorCategoria: Array<{ categoria: string; monto: number }>;
  topProyectos: Array<{ nombre: string; presupuesto: number }>;
  variacionPresupuestal: Array<{ proyecto: string; planeado: number; ejecutado: number }>;
}

export const DashboardPresupuestos: React.FC = () => {
  const [data, setData] = useState<PresupuestoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPresupuestoData();
  }, []);

  const fetchPresupuestoData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/dashboard/presupuestos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching presupuesto data:', error);
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

  const porcentajeDisponible = data.kpis.presupuestoTotal > 0
    ? ((data.kpis.presupuestoDisponible / data.kpis.presupuestoTotal) * 100).toFixed(1)
    : '0';

  return (
    <DashboardLayout>
      <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard de Presupuestos</h1>
        <p className="dashboard-subtitle">Análisis financiero y control presupuestal</p>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Presupuesto Total"
          value={`$${data.kpis.presupuestoTotal.toLocaleString()}`}
          color="#3b82f6"
        />
        <KPICard
          title="Presupuesto Ejecutado"
          value={`$${data.kpis.presupuestoEjecutado.toLocaleString()}`}
          subtitle={`${porcentajeEjecutado}% del total`}
          color="#ef4444"
        />
        <KPICard
          title="Presupuesto Disponible"
          value={`$${data.kpis.presupuestoDisponible.toLocaleString()}`}
          subtitle={`${porcentajeDisponible}% restante`}
          color="#10b981"
        />
        <KPICard
          title="Eficiencia de Gasto"
          value={`${data.kpis.eficienciaGasto.toFixed(1)}%`}
          color="#8b5cf6"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <PieChart
            data={data.distribucionPorCategoria}
            dataKey="monto"
            nameKey="categoria"
            title="Distribución Presupuestal por Categoría"
            height={350}
            colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']}
          />
        </div>

        <div className="chart-item">
          <BarChart
            data={data.topProyectos}
            dataKey="presupuesto"
            xAxisKey="nombre"
            title="Top 10 Proyectos por Inversión"
            color="#f59e0b"
            height={350}
          />
        </div>

        <div className="chart-item chart-full-width">
          <div className="chart-container">
            <h3 className="chart-title">Análisis de Variación: Planeado vs Ejecutado</h3>
            <div className="budget-comparison-table">
              <table>
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Presupuesto Planeado</th>
                    <th>Presupuesto Ejecutado</th>
                    <th>Variación</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variacionPresupuestal.map((item, index) => {
                    const variacion = item.ejecutado - item.planeado;
                    const porcentajeVariacion = item.planeado > 0
                      ? ((variacion / item.planeado) * 100).toFixed(1)
                      : '0';
                    const esSobrepresupuesto = variacion > 0;

                    return (
                      <tr key={index}>
                        <td>{item.proyecto}</td>
                        <td>${item.planeado.toLocaleString()}</td>
                        <td>${item.ejecutado.toLocaleString()}</td>
                        <td className={esSobrepresupuesto ? 'negative' : 'positive'}>
                          ${Math.abs(variacion).toLocaleString()} ({porcentajeVariacion}%)
                        </td>
                        <td>
                          <span className={`badge ${esSobrepresupuesto ? 'badge-danger' : 'badge-success'}`}>
                            {esSobrepresupuesto ? 'Sobre presupuesto' : 'Dentro del presupuesto'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="budget-summary">
        <h3>Resumen Financiero</h3>
        <div className="summary-cards">
          <div className="summary-card">
            <h4>Categoría con Mayor Gasto</h4>
            <p className="summary-value">
              {data.distribucionPorCategoria.length > 0
                ? data.distribucionPorCategoria.reduce((max, cat) => cat.monto > max.monto ? cat : max).categoria
                : 'N/A'}
            </p>
          </div>
          <div className="summary-card">
            <h4>Proyecto más Costoso</h4>
            <p className="summary-value">
              {data.topProyectos.length > 0
                ? data.topProyectos[0].nombre
                : 'N/A'}
            </p>
          </div>
          <div className="summary-card">
            <h4>Promedio por Proyecto</h4>
            <p className="summary-value">
              ${data.topProyectos.length > 0
                ? (data.kpis.presupuestoTotal / data.topProyectos.length).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : '0'}
            </p>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
};
