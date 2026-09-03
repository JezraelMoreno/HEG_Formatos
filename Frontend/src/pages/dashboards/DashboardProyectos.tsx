import React, { useState, useEffect } from 'react';
import { BackButton } from '../../components/BackButton';
import API_URL from '../../config';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { PieChart } from '../../components/charts/PieChart';
import { LineChart } from '../../components/charts/LineChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface ProyectosData {
  kpis: {
    totalProyectos: number;
    proyectosEnProgreso: number;
    proyectosCompletados: number;
    proyectosPendientes: number;
    tasaCompletacion: number;
  };
  proyectosPorEstado: Array<{ estado: string; cantidad: number }>;
  proyectosCriticos: Array<{
    id: number;
    nombre: string;
    estado: string;
    presupuestoUtilizado: number;
    diasRestantes: number;
  }>;
  timelineProyectos: Array<{ mes: string; iniciados: number; completados: number }>;
}

export const DashboardProyectos: React.FC = () => {
  const [data, setData] = useState<ProyectosData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProyectosData();
  }, []);

  const fetchProyectosData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/dashboard/proyectos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching proyectos data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-layout">
        <BackButton />
        <div className="dashboard-loading">Cargando dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-layout">
        <BackButton />
        <div className="dashboard-error">Error al cargar los datos</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <BackButton />
      <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard de Proyectos</h1>
        <p className="dashboard-subtitle">Seguimiento y control de proyectos</p>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Total de Proyectos"
          value={data.kpis.totalProyectos}
          color="#3b82f6"
        />
        <KPICard
          title="En Progreso"
          value={data.kpis.proyectosEnProgreso}
          color="#f59e0b"
        />
        <KPICard
          title="Completados"
          value={data.kpis.proyectosCompletados}
          color="#10b981"
        />
        <KPICard
          title="Tasa de Completación"
          value={`${data.kpis.tasaCompletacion.toFixed(1)}%`}
          color="#8b5cf6"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <PieChart
            data={data.proyectosPorEstado}
            dataKey="cantidad"
            nameKey="estado"
            title="Distribución por Estado"
            height={350}
          />
        </div>

        <div className="chart-item">
          <BarChart
            data={data.timelineProyectos}
            dataKey="completados"
            xAxisKey="mes"
            title="Proyectos Completados por Mes"
            color="#10b981"
            height={350}
          />
        </div>

        <div className="chart-item chart-full-width">
          <LineChart
            data={data.timelineProyectos}
            dataKey="iniciados"
            xAxisKey="mes"
            title="Proyectos Iniciados por Mes"
            color="#3b82f6"
            height={350}
          />
        </div>
      </div>

      <div className="critical-projects-section">
        <h3>Proyectos Críticos - Requieren Atención</h3>
        <div className="critical-projects-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre del Proyecto</th>
                <th>Estado</th>
                <th>Presupuesto Utilizado</th>
                <th>Días Restantes</th>
                <th>Prioridad</th>
              </tr>
            </thead>
            <tbody>
              {data.proyectosCriticos.length > 0 ? (
                data.proyectosCriticos.map((proyecto) => {
                  const esUrgente = proyecto.diasRestantes < 7 || proyecto.presupuestoUtilizado > 80;
                  const prioridad = esUrgente ? 'Alta' : proyecto.presupuestoUtilizado > 60 ? 'Media' : 'Normal';
                  const clasePrioridad = esUrgente ? 'badge-danger' : proyecto.presupuestoUtilizado > 60 ? 'badge-warning' : 'badge-info';

                  return (
                    <tr key={proyecto.id} className={esUrgente ? 'urgent-row' : ''}>
                      <td>{proyecto.id}</td>
                      <td>{proyecto.nombre}</td>
                      <td>
                        <span className="badge badge-info">{proyecto.estado}</span>
                      </td>
                      <td>
                        <div className="progress-cell">
                          <div className="progress-bar">
                            <div
                              className={`progress-fill ${proyecto.presupuestoUtilizado > 80 ? 'progress-danger' : proyecto.presupuestoUtilizado > 60 ? 'progress-warning' : 'progress-success'}`}
                              style={{ width: `${Math.min(proyecto.presupuestoUtilizado, 100)}%` }}
                            ></div>
                          </div>
                          <span>{proyecto.presupuestoUtilizado.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={proyecto.diasRestantes < 7 ? 'text-danger' : ''}>
                          {proyecto.diasRestantes} días
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${clasePrioridad}`}>{prioridad}</span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                    No hay proyectos críticos en este momento
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="project-insights">
        <h3>Insights y Recomendaciones</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Proyectos en Progreso</h4>
            <p>
              Hay {data.kpis.proyectosEnProgreso} proyectos actualmente en desarrollo.
              {data.kpis.proyectosEnProgreso > 5 && ' Considere revisar la capacidad del equipo.'}
            </p>
          </div>
          <div className="insight-card">
            <h4>Proyectos Críticos</h4>
            <p>
              {data.proyectosCriticos.length > 0
                ? `${data.proyectosCriticos.length} proyectos requieren atención inmediata.`
                : 'Todos los proyectos están dentro de los parámetros normales.'}
            </p>
          </div>
          <div className="insight-card">
            <h4>Tasa de Éxito</h4>
            <p>
              La tasa de completación actual es del {data.kpis.tasaCompletacion.toFixed(1)}%.
              {data.kpis.tasaCompletacion > 80 && ' ¡Excelente desempeño!'}
              {data.kpis.tasaCompletacion < 50 && ' Se recomienda revisar procesos.'}
            </p>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};
