import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { KPICard } from '../../components/charts/KPICard';
import '../../components/styles/KPICard.css';
import '../../components/styles/charts.css';
import './dashboards.css';

interface CobranzaProyecto {
  id_proyecto: number;
  proyecto: string;
  codigo_control: string;
  importe_contratado: number;
  importe_cobrado: number;
  importe_a_cobrar: number;
  fondo_garantia: number;
  liquido_por_cobrar: number;
  facturas_por_cobrar: number;
  aplicado: number;
  cobrado_vs_aplicado: number;
  estado: string;
}

interface CobranzaTotales {
  importe_contratado: number;
  importe_cobrado: number;
  importe_a_cobrar: number;
  fondo_garantia: number;
  liquido_por_cobrar: number;
  facturas_por_cobrar: number;
  aplicado: number;
  cobrado_vs_aplicado: number;
}

interface CobranzaData {
  data: CobranzaProyecto[];
  totales: CobranzaTotales;
  proyectos_en_rojo: number;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const DashboardCobranza: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CobranzaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'en_progreso' | 'completado' | 'en_rojo'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [exportando, setExportando] = useState(false);

  const fetchCobranzaData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/cobranza-general', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result);
        } else {
          setError(result.message || 'Error al cargar datos');
        }
      } else {
        setError('Error de conexión');
      }
    } catch (err) {
      console.error('Error fetching cobranza data:', err);
      setError('Error al cargar los datos de cobranza');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCobranzaData();
  }, [fetchCobranzaData]);

  const exportarExcel = async () => {
    try {
      setExportando(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/cobranza-general/export', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cobranza_general_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError('Error al exportar');
      }
    } catch (err) {
      console.error('Error exportando:', err);
      setError('Error al exportar el archivo');
    } finally {
      setExportando(false);
    }
  };

  const irAProyecto = (idProyecto: number) => {
    navigate(`/proyecto/${idProyecto}`, { state: { moduloOrigen: 'contabilidad' } });
  };

  const proyectosFiltrados = data?.data.filter(p => {
    // Filtro por estado
    if (filtroEstado === 'en_progreso' && p.estado !== 'en_progreso') return false;
    if (filtroEstado === 'completado' && p.estado !== 'completado') return false;
    if (filtroEstado === 'en_rojo' && p.cobrado_vs_aplicado >= 0) return false;

    // Filtro por búsqueda
    if (busqueda) {
      const searchLower = busqueda.toLowerCase();
      return p.proyecto.toLowerCase().includes(searchLower) ||
             p.codigo_control.toLowerCase().includes(searchLower);
    }
    return true;
  }) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="dashboard-loading">Cargando cobranza general...</div>
      </DashboardLayout>
    );
  }

  if (error && !data) {
    return (
      <DashboardLayout>
        <div className="dashboard-error">{error}</div>
      </DashboardLayout>
    );
  }

  const totales = data?.totales || {
    importe_contratado: 0,
    importe_cobrado: 0,
    importe_a_cobrar: 0,
    fondo_garantia: 0,
    liquido_por_cobrar: 0,
    facturas_por_cobrar: 0,
    aplicado: 0,
    cobrado_vs_aplicado: 0
  };

  const porcentajeCobrado = totales.importe_contratado > 0
    ? ((totales.importe_cobrado / totales.importe_contratado) * 100).toFixed(1)
    : '0';

  return (
    <DashboardLayout>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1>Cobranza General</h1>
            <p className="dashboard-subtitle">Tabla de cobranza a clientes - HEG Diseño e Instalación</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={exportarExcel}
            disabled={exportando}
          >
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <KPICard
            title="Importe Contratado"
            value={formatCurrency(totales.importe_contratado)}
            subtitle={`${data?.data.length || 0} proyectos`}
            color="#3b82f6"
          />
          <KPICard
            title="Importe Cobrado"
            value={formatCurrency(totales.importe_cobrado)}
            subtitle={`${porcentajeCobrado}% del contratado`}
            color="#10b981"
          />
          <KPICard
            title="Líquido por Cobrar"
            value={formatCurrency(totales.liquido_por_cobrar)}
            color="#f59e0b"
          />
          <KPICard
            title="Cobrado vs Aplicado"
            value={formatCurrency(totales.cobrado_vs_aplicado)}
            subtitle={`${data?.proyectos_en_rojo || 0} proyectos en rojo`}
            color={totales.cobrado_vs_aplicado < 0 ? '#ef4444' : '#10b981'}
          />
        </div>

        {/* Filtros */}
        <div className="cobranza-filtros">
          <input
            type="text"
            placeholder="Buscar proyecto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          >
            <option value="todos">Todos los proyectos</option>
            <option value="en_progreso">En progreso</option>
            <option value="completado">Completados</option>
            <option value="en_rojo">En números rojos</option>
          </select>
          <span className="cobranza-count">
            Mostrando {proyectosFiltrados.length} de {data?.data.length || 0} proyectos
          </span>
        </div>

        {/* Tabla de cobranza */}
        <div className="cobranza-tabla-wrapper">
          <table className="tabla-cobranza">
            <thead>
              <tr>
                <th>N</th>
                <th className="text-left">Proyecto</th>
                <th>Control</th>
                <th className="text-right">Importe Contratado</th>
                <th className="text-right">Importe Cobrado</th>
                <th className="text-right">Importe a Cobrar</th>
                <th className="text-right">Fondo Garantía</th>
                <th className="text-right">Líquido por Cobrar</th>
                <th className="text-right">Facturas por Cobrar</th>
                <th className="text-right">Aplicado</th>
                <th className="text-right">Cobrado vs Aplicado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {proyectosFiltrados.map((row, idx) => {
                const enRojo = row.cobrado_vs_aplicado < 0;
                return (
                  <tr
                    key={row.id_proyecto}
                    className={enRojo ? 'en-rojo' : ''}
                    onClick={() => irAProyecto(row.id_proyecto)}
                  >
                    <td className="text-center">{idx + 1}</td>
                    <td className="proyecto-nombre">{row.proyecto}</td>
                    <td className="text-center">{row.codigo_control || '-'}</td>
                    <td className="text-right">{formatCurrency(row.importe_contratado)}</td>
                    <td className="text-right">{formatCurrency(row.importe_cobrado)}</td>
                    <td className="text-right">{formatCurrency(row.importe_a_cobrar)}</td>
                    <td className="text-right">{formatCurrency(row.fondo_garantia)}</td>
                    <td className="text-right">{formatCurrency(row.liquido_por_cobrar)}</td>
                    <td className="text-right">{formatCurrency(row.facturas_por_cobrar)}</td>
                    <td className="text-right">{formatCurrency(row.aplicado)}</td>
                    <td className={`text-right ${enRojo ? 'valor-negativo' : 'valor-positivo'}`}>
                      {formatCurrency(row.cobrado_vs_aplicado)}
                    </td>
                    <td className="text-center">
                      <span className={`estado-badge ${row.estado === 'en_progreso' ? 'en-progreso' : 'completado'}`}>
                        {row.estado === 'en_progreso' ? 'En progreso' : 'Completado'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>TOTALES</td>
                <td className="text-right">{formatCurrency(totales.importe_contratado)}</td>
                <td className="text-right">{formatCurrency(totales.importe_cobrado)}</td>
                <td className="text-right">{formatCurrency(totales.importe_a_cobrar)}</td>
                <td className="text-right">{formatCurrency(totales.fondo_garantia)}</td>
                <td className="text-right">{formatCurrency(totales.liquido_por_cobrar)}</td>
                <td className="text-right">{formatCurrency(totales.facturas_por_cobrar)}</td>
                <td className="text-right">{formatCurrency(totales.aplicado)}</td>
                <td className={`text-right ${totales.cobrado_vs_aplicado < 0 ? 'valor-negativo' : 'valor-positivo'}`}>
                  {formatCurrency(totales.cobrado_vs_aplicado)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Resumen de proyectos en rojo */}
        {(data?.proyectos_en_rojo || 0) > 0 && (
          <div className="alerta-proyectos-rojo">
            <h3>Proyectos en números rojos ({data?.proyectos_en_rojo})</h3>
            <p>
              Estos proyectos tienen más gastos aplicados que cobranza recibida.
              Requieren atención inmediata para evitar pérdidas.
            </p>
            <div className="proyectos-rojo-lista">
              {data?.data
                .filter(p => p.cobrado_vs_aplicado < 0)
                .sort((a, b) => a.cobrado_vs_aplicado - b.cobrado_vs_aplicado)
                .slice(0, 5)
                .map(p => (
                  <button
                    key={p.id_proyecto}
                    className="proyecto-rojo-btn"
                    onClick={() => irAProyecto(p.id_proyecto)}
                  >
                    {p.proyecto}: {formatCurrency(p.cobrado_vs_aplicado)}
                  </button>
                ))}
            </div>
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
