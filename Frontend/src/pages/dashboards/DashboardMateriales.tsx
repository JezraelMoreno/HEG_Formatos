import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface MaterialesData {
  kpis: {
    totalMateriales: number;
    valorTotalInventario: number;
    materialesCriticos: number;
    proveedoresActivos: number;
  };
  materialesMasUsados: Array<{ material: string; cantidad: number; unidad: string }>;
  costoPorCategoria: Array<{ categoria: string; costo: number }>;
  proveedoresPrincipales: Array<{ proveedor: string; volumen: number }>;
  proyeccionCompras: Array<{
    material: string;
    cantidadRequerida: number;
    cantidadDisponible: number;
    deficit: number;
    costoEstimado: number;
  }>;
  tendenciaCostos: Array<{ mes: string; costo: number }>;
}

export const DashboardMateriales: React.FC = () => {
  const [data, setData] = useState<MaterialesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterialesData();
  }, []);

  const fetchMaterialesData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/api/dashboard/materiales', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Error fetching materiales data:', error);
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

  return (
    <DashboardLayout>
      <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard de Materiales y Explosión de Insumos</h1>
        <p className="dashboard-subtitle">Gestión de inventario y proyección de compras</p>
      </div>

      <div className="kpi-grid">
        <KPICard
          title="Total de Materiales"
          value={data.kpis.totalMateriales}
          color="#3b82f6"
        />
        <KPICard
          title="Valor del Inventario"
          value={`$${data.kpis.valorTotalInventario.toLocaleString()}`}
          color="#10b981"
        />
        <KPICard
          title="Materiales Críticos"
          value={data.kpis.materialesCriticos}
          subtitle="Requieren reabastecimiento"
          color="#ef4444"
        />
        <KPICard
          title="Proveedores Activos"
          value={data.kpis.proveedoresActivos}
          color="#8b5cf6"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-item">
          <BarChart
            data={data.materialesMasUsados.slice(0, 10)}
            dataKey="cantidad"
            xAxisKey="material"
            title="Top 10 Materiales Más Utilizados"
            color="#3b82f6"
            height={350}
          />
        </div>

        <div className="chart-item">
          <PieChart
            data={data.costoPorCategoria}
            dataKey="costo"
            nameKey="categoria"
            title="Distribución de Costos por Categoría"
            height={350}
          />
        </div>

        <div className="chart-item">
          <BarChart
            data={data.proveedoresPrincipales}
            dataKey="volumen"
            xAxisKey="proveedor"
            title="Proveedores Principales por Volumen"
            color="#10b981"
            height={350}
          />
        </div>

        <div className="chart-item">
          <BarChart
            data={data.tendenciaCostos}
            dataKey="costo"
            xAxisKey="mes"
            title="Tendencia de Costos Mensuales"
            color="#f59e0b"
            height={350}
          />
        </div>
      </div>

      <div className="materials-projection-section">
        <h3>Proyección de Compras - Explosión de Materiales</h3>
        <p className="section-description">
          Materiales requeridos agregados de todos los proyectos activos
        </p>
        <div className="materials-table">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Cantidad Requerida</th>
                <th>Disponible en Inventario</th>
                <th>Déficit</th>
                <th>Costo Estimado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.proyeccionCompras.length > 0 ? (
                data.proyeccionCompras.map((item, index) => {
                  const necesitaCompra = item.deficit > 0;
                  const porcentajeDisponible = item.cantidadRequerida > 0
                    ? ((item.cantidadDisponible / item.cantidadRequerida) * 100).toFixed(0)
                    : '100';

                  return (
                    <tr key={index} className={necesitaCompra ? 'needs-purchase' : ''}>
                      <td>{item.material}</td>
                      <td>{item.cantidadRequerida.toLocaleString()}</td>
                      <td>
                        {item.cantidadDisponible.toLocaleString()} ({porcentajeDisponible}%)
                      </td>
                      <td className={necesitaCompra ? 'text-danger' : 'text-success'}>
                        {necesitaCompra ? item.deficit.toLocaleString() : '-'}
                      </td>
                      <td>${item.costoEstimado.toLocaleString()}</td>
                      <td>
                        <span className={`badge ${necesitaCompra ? 'badge-danger' : 'badge-success'}`}>
                          {necesitaCompra ? 'Comprar' : 'Suficiente'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>
                    No hay datos de proyección disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.proyeccionCompras.some(item => item.deficit > 0) && (
          <div className="purchase-summary">
            <h4>Resumen de Compras Necesarias</h4>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Materiales a Comprar:</span>
                <span className="stat-value">
                  {data.proyeccionCompras.filter(item => item.deficit > 0).length}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Inversión Total Estimada:</span>
                <span className="stat-value">
                  ${data.proyeccionCompras
                    .filter(item => item.deficit > 0)
                    .reduce((sum, item) => sum + item.costoEstimado, 0)
                    .toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="materials-insights">
        <h3>Análisis y Recomendaciones</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Optimización</h4>
            <p>
              {data.materialesMasUsados.length > 0
                ? `El material más utilizado es "${data.materialesMasUsados[0].material}". Considere negociar mejores precios por volumen.`
                : 'No hay datos suficientes para análisis.'}
            </p>
          </div>
          <div className="insight-card">
            <h4>Proveedores</h4>
            <p>
              Trabaja con {data.kpis.proveedoresActivos} proveedores activos.
              {data.kpis.proveedoresActivos < 3 && ' Considere diversificar proveedores para reducir riesgos.'}
            </p>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
};
