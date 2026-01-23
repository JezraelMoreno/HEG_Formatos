import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProjectSelector.css';

interface Proyecto {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string;
  estado: 'en_progreso' | 'completado';
  presupuesto_total?: number;
  presupuesto?: number;
  total_pedidos?: number;
}

export const ProjectSelector: React.FC = () => {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'en_progreso' | 'completado'>('todos');

  useEffect(() => {
    cargarProyectos();
  }, []);

  const cargarProyectos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/proyectos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setProyectos(result.data);
        }
      }
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
    } finally {
      setLoading(false);
    }
  };

  const proyectosFiltrados = proyectos.filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const coincideEstado = filtroEstado === 'todos' || p.estado === filtroEstado;
    return coincideBusqueda && coincideEstado;
  });

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatearMoneda = (valor: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(valor);
  };

  const seleccionarProyecto = (proyecto: Proyecto) => {
    navigate(`/dashboards/${proyecto.id_proyecto}/ejecutivo`, {
      state: { nombreProyecto: proyecto.nombre }
    });
  };

  if (loading) {
    return (
      <div className="project-selector-container">
        <div className="project-selector-loading">Cargando proyectos...</div>
      </div>
    );
  }

  return (
    <div className="project-selector-container">
      <div className="project-selector-header">
        <button className="back-button" onClick={() => navigate('/home')}>
          ← Volver al Inicio
        </button>
        <h1>Seleccionar Proyecto</h1>
        <p>Selecciona un proyecto para ver sus estadísticas detalladas</p>
      </div>

      <div className="project-selector-filters">
        <input
          type="text"
          placeholder="Buscar proyecto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="project-search-input"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as 'todos' | 'en_progreso' | 'completado')}
          className="project-filter-select"
        >
          <option value="todos">Todos los estados</option>
          <option value="en_progreso">En Progreso</option>
          <option value="completado">Completados</option>
        </select>
        <span className="project-count">
          {proyectosFiltrados.length} proyecto{proyectosFiltrados.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="project-selector-grid">
        {proyectosFiltrados.map((proyecto) => {
          const presupuesto = proyecto.presupuesto_total || proyecto.presupuesto || 0;
          const gastado = proyecto.total_pedidos || 0;
          const porcentajeGastado = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;

          return (
            <button
              key={proyecto.id_proyecto}
              className="project-card"
              onClick={() => seleccionarProyecto(proyecto)}
            >
              <div className="project-card-header">
                <span className={`project-status ${proyecto.estado}`}>
                  {proyecto.estado === 'en_progreso' ? 'En Progreso' : 'Completado'}
                </span>
                <span className="project-date">{formatearFecha(proyecto.fecha_proyecto)}</span>
              </div>

              <h3 className="project-name">{proyecto.nombre}</h3>

              <div className="project-budget-info">
                <div className="budget-row">
                  <span className="budget-label">Presupuesto:</span>
                  <span className="budget-value">{formatearMoneda(presupuesto)}</span>
                </div>
                <div className="budget-row">
                  <span className="budget-label">Gastado:</span>
                  <span className="budget-value spent">{formatearMoneda(gastado)}</span>
                </div>
                <div className="budget-progress">
                  <div
                    className={`budget-progress-bar ${porcentajeGastado > 80 ? 'warning' : ''} ${porcentajeGastado > 100 ? 'danger' : ''}`}
                    style={{ width: `${Math.min(porcentajeGastado, 100)}%` }}
                  />
                </div>
                <span className="budget-percentage">{porcentajeGastado.toFixed(1)}% utilizado</span>
              </div>

              <div className="project-card-arrow">Ver Dashboards →</div>
            </button>
          );
        })}
      </div>

      {proyectosFiltrados.length === 0 && (
        <div className="no-projects">
          No se encontraron proyectos que coincidan con los filtros
        </div>
      )}
    </div>
  );
};
