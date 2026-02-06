import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../dashboards/ProjectSelector.css';

interface Proyecto {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string;
  estado: 'en_progreso' | 'completado';
  presupuesto_total?: number;
  presupuesto?: number;
  total_pedidos?: number;
}

export function ReportesProjectSelector() {
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
        headers: { 'Authorization': `Bearer ${token}` }
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

  const formatearFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatearMoneda = (valor: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor);

  const seleccionarProyecto = (proyecto: Proyecto) => {
    navigate(`/reportes/${proyecto.id_proyecto}`, {
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
        <div className="ps-titulo-bloque">
          <h1 className="ps-titulo">Reportes de Existencia y Remisiones</h1>
        </div>
        <div className="ps-actions">
          <div className="ps-search-bar">
            <input
              type="text"
              placeholder="Buscar proyecto"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as 'todos' | 'en_progreso' | 'completado')}
            className="ps-filter-select"
          >
            <option value="todos">Todos los estados</option>
            <option value="en_progreso">En Progreso</option>
            <option value="completado">Completados</option>
          </select>
          <button className="ps-action-button ps-secondary-button" onClick={() => navigate('/home')}>
            Volver al Inicio
          </button>
        </div>
      </div>

      <div className="ps-contenido">
        <section className="ps-panel">
          <div className="ps-proyectos-wrapper">
            <ul className="ps-lista-proyectos">
              {proyectosFiltrados.map((proyecto) => {
                const presupuesto = proyecto.presupuesto_total || proyecto.presupuesto || 0;
                const gastado = proyecto.total_pedidos || 0;
                const disponible = presupuesto - gastado;
                const claseDisponible = disponible < 0 ? "ps-presupuesto-disponible negativo" : "ps-presupuesto-disponible positivo";

                return (
                  <li
                    key={proyecto.id_proyecto}
                    className="ps-item-proyecto"
                    onClick={() => seleccionarProyecto(proyecto)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="ps-proyecto-info">
                      <span className="ps-nombre">{proyecto.nombre}</span>
                      <span className="ps-fecha">{formatearFecha(proyecto.fecha_proyecto)}</span>
                      <div className="ps-presupuesto-resumen">
                        <span>Asignado: {formatearMoneda(presupuesto)}</span>
                        <span>Gastado: {formatearMoneda(gastado)}</span>
                        <span className={claseDisponible}>Disponible: {formatearMoneda(disponible)}</span>
                      </div>
                      <span className={`ps-estado-badge ${proyecto.estado}`}>
                        {proyecto.estado === 'en_progreso' ? 'En Progreso' : 'Completado'}
                      </span>
                    </div>
                    <span className="ps-card-arrow">Ver Reportes &rarr;</span>
                  </li>
                );
              })}
              {proyectosFiltrados.length === 0 && (
                <li>No se encontraron proyectos que coincidan con los filtros</li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
