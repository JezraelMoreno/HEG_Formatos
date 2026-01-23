import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import { BarChart } from '../../components/charts/BarChart';
import { PieChart } from '../../components/charts/PieChart';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface MaterialesData {
  proyecto: {
    id: number;
    nombre: string;
  };
  kpis: {
    totalConceptos: number;
    totalGastado: number;
    totalPedidos: number;
    totalProveedores: number;
  };
  materialesUsados: Array<{
    material: string;
    cantidad: number;
    costoTotal: number;
  }>;
  explosionInsumos: Array<{
    familia: string;
    clan: string;
    presupuesto: number;
  }>;
  costoPorTipo: Array<{
    tipo: string;
    cantidad: number;
    costoTotal: number;
  }>;
  proveedores: Array<{
    proveedor: string;
    cantidadPedidos: number;
    totalCompras: number;
  }>;
}

export const DashboardMateriales: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MaterialesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || isNaN(Number(projectId))) {
      navigate('/dashboards');
      return;
    }
    fetchMaterialesData();
  }, [projectId, navigate]);

  const fetchMaterialesData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3000/api/dashboard/proyecto/${projectId}/materiales`, {
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
      console.error('Error fetching materiales data:', error);
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

  // Preparar datos para gráficas
  const costoPorTipoData = data.costoPorTipo.map(item => ({
    tipo: item.tipo,
    costo: item.costoTotal
  }));

  return (
    <DashboardLayout projectName={data.proyecto.nombre}>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>Dashboard de Materiales</h1>
          <p className="dashboard-subtitle">Gestión de insumos y materiales del proyecto</p>
        </div>

        <div className="kpi-grid">
          <KPICard
            title="Total Gastado"
            value={formatCurrency(data.kpis.totalGastado)}
            color="#3b82f6"
          />
          <KPICard
            title="Pedidos Realizados"
            value={data.kpis.totalPedidos}
            color="#10b981"
          />
          <KPICard
            title="Conceptos Diferentes"
            value={data.kpis.totalConceptos}
            color="#f59e0b"
          />
          <KPICard
            title="Proveedores"
            value={data.kpis.totalProveedores}
            color="#8b5cf6"
          />
        </div>

        <div className="charts-grid">
          {costoPorTipoData.length > 0 && (
            <div className="chart-item">
              <PieChart
                data={costoPorTipoData}
                dataKey="costo"
                nameKey="tipo"
                title="Distribución de Gastos por Concepto"
                height={350}
              />
            </div>
          )}

          {data.proveedores.length > 0 && (
            <div className="chart-item">
              <BarChart
                data={data.proveedores}
                dataKey="totalCompras"
                xAxisKey="proveedor"
                title="Compras por Proveedor"
                color="#10b981"
                height={350}
              />
            </div>
          )}
        </div>

        {data.explosionInsumos.length > 0 && (
          <div className="materials-projection-section">
            <h3>Explosión de Insumos</h3>
            <p className="section-description">
              Distribución del presupuesto por familia de insumos
            </p>
            <div className="materials-table">
              <table>
                <thead>
                  <tr>
                    <th>Familia</th>
                    <th>Clan</th>
                    <th>Presupuesto Asignado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.explosionInsumos.map((item, index) => (
                    <tr key={index}>
                      <td>{item.familia}</td>
                      <td>{item.clan || '-'}</td>
                      <td className="text-right">{formatCurrency(item.presupuesto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}><strong>Total</strong></td>
                    <td className="text-right">
                      <strong>
                        {formatCurrency(data.explosionInsumos.reduce((sum, item) => sum + item.presupuesto, 0))}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {data.materialesUsados.length > 0 && (
          <div className="materials-projection-section">
            <h3>Materiales Utilizados (Misceláneos)</h3>
            <div className="materials-table">
              <table>
                <thead>
                  <tr>
                    <th>Material / Descripción</th>
                    <th>Cantidad</th>
                    <th>Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.materialesUsados.map((item, index) => (
                    <tr key={index}>
                      <td>{item.material}</td>
                      <td>{item.cantidad.toLocaleString()}</td>
                      <td className="text-right">{formatCurrency(item.costoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {data.costoPorTipo.length > 0 && (
          <div className="materials-projection-section">
            <h3>Resumen por Tipo de Pedido</h3>
            <div className="materials-table">
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Cantidad de Pedidos</th>
                    <th>Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.costoPorTipo.map((item, index) => (
                    <tr key={index}>
                      <td>{item.tipo}</td>
                      <td>{item.cantidad}</td>
                      <td className="text-right">{formatCurrency(item.costoTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td><strong>Total</strong></td>
                    <td><strong>{data.costoPorTipo.reduce((sum, item) => sum + item.cantidad, 0)}</strong></td>
                    <td className="text-right">
                      <strong>
                        {formatCurrency(data.costoPorTipo.reduce((sum, item) => sum + item.costoTotal, 0))}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
