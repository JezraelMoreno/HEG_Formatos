import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { LineChart } from '../../components/charts/LineChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';
import API_URL from '../../config';

interface GeneralData {
  proyecto: {
    id: number;
    nombre: string;
    estado: string;
    fechaProyecto: string;
    diasTranscurridos: number;
  };
  kpis: {
    presupuestoTotal: number;
    totalGastado: number;
    presupuestoDisponible: number;
    cantidadPedidos: number;
    cantidadProveedores: number;
  };
  proveedores: Array<{
    proveedor: string;
    cantidadPedidos: number;
    totalCompras: number;
  }>;
  timelinePedidos: Array<{
    mes: string;
    cantidadPedidos: number;
    totalMes: number;
  }>;
  ultimosPedidos: Array<{
    id: number;
    concepto: string;
    proveedor: string;
    importe: number;
    fecha: string;
    estatusPago: string;
  }>;
}

export const DashboardGeneral: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<GeneralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || isNaN(Number(projectId))) {
      navigate('/dashboards');
      return;
    }
    fetchGeneralData();
  }, [projectId, navigate]);

  const fetchGeneralData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/dashboard/proyecto/${projectId}/general`, {
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
      console.error('Error fetching general data:', error);
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

  return (
    <DashboardLayout projectName={data.proyecto.nombre}>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard General</h1>
          <p className="dashboard-subtitle">
            Resumen del proyecto - {data.proyecto.diasTranscurridos} días transcurridos -
            Estado: <span className={`status-badge ${data.proyecto.estado === 'En Progreso' ? 'en-progreso' : 'completado'}`}>{data.proyecto.estado}</span>
          </p>
        </div>

        <div className="kpi-grid">
          <KPICard
            title="Presupuesto Total"
            value={formatCurrency(data.kpis.presupuestoTotal)}
            color="#3b82f6"
          />
          <KPICard
            title="Total Gastado"
            value={formatCurrency(data.kpis.totalGastado)}
            color="#f59e0b"
          />
          <KPICard
            title="Presupuesto Disponible"
            value={formatCurrency(data.kpis.presupuestoDisponible)}
            color={data.kpis.presupuestoDisponible < 0 ? '#ef4444' : '#10b981'}
          />
          <KPICard
            title="Pedidos Realizados"
            value={data.kpis.cantidadPedidos}
            subtitle={`${data.kpis.cantidadProveedores} proveedores`}
            color="#8b5cf6"
          />
        </div>

        <div className="charts-grid">
          {data.proveedores.length > 0 && (
            <div className="chart-item">
              <BarChart
                data={data.proveedores}
                dataKey="totalCompras"
                xAxisKey="proveedor"
                title="Compras por Proveedor"
                color="#3b82f6"
                height={350}
              />
            </div>
          )}

          {data.timelinePedidos.length > 0 && (
            <div className="chart-item">
              <LineChart
                data={data.timelinePedidos}
                dataKey="totalMes"
                xAxisKey="mes"
                title="Gastos por Mes"
                color="#10b981"
                height={350}
              />
            </div>
          )}
        </div>

        <div className="critical-projects-section">
          <h3>Últimos Pedidos</h3>
          <div className="critical-projects-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Concepto</th>
                  <th>Proveedor</th>
                  <th>Importe</th>
                  <th>Fecha</th>
                  <th>Estatus</th>
                </tr>
              </thead>
              <tbody>
                {data.ultimosPedidos.length > 0 ? (
                  data.ultimosPedidos.map((pedido) => (
                    <tr key={pedido.id}>
                      <td>{pedido.id}</td>
                      <td>{pedido.concepto}</td>
                      <td>{pedido.proveedor || '-'}</td>
                      <td className="text-right">{formatCurrency(pedido.importe)}</td>
                      <td>{formatDate(pedido.fecha)}</td>
                      <td>
                        <span className={`badge ${pedido.estatusPago === 'pagado' ? 'badge-success' : 'badge-warning'}`}>
                          {pedido.estatusPago || 'Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No hay pedidos registrados para este proyecto
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {data.proveedores.length > 0 && (
          <div className="project-insights">
            <h3>Proveedores del Proyecto</h3>
            <div className="insights-grid">
              {data.proveedores.slice(0, 3).map((prov, index) => (
                <div key={index} className="insight-card">
                  <h4>{prov.proveedor}</h4>
                  <p>
                    {prov.cantidadPedidos} pedido{prov.cantidadPedidos !== 1 ? 's' : ''} - {formatCurrency(prov.totalCompras)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
