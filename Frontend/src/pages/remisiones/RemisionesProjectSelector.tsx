import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../dashboards/ProjectSelector.css';
import { AgregarRemisionModal } from './AgregarRemisionModal';
import { HistorialEntregas } from './HistorialEntregas';

interface Proyecto {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string;
  estado: 'en_progreso' | 'completado';
  presupuesto_total?: number;
  presupuesto?: number;
  total_pedidos?: number;
}

export function RemisionesProjectSelector() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'en_progreso' | 'completado'>('todos');

  // Modal states
  const [showAgregarRemision, setShowAgregarRemision] = useState(false);
  const [showHistorial, setShowHistorial] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const proyectosRes = await fetch('http://localhost:3000/proyectos', { headers });

      if (proyectosRes.ok) {
        const result = await proyectosRes.json();
        if (result.success && Array.isArray(result.data)) {
          setProyectos(result.data);
        }
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
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

  const seleccionarProyecto = (proyecto: Proyecto) => {
    navigate(`/remisiones/${proyecto.id_proyecto}`, {
      state: { nombreProyecto: proyecto.nombre }
    });
  };

  const irAVistaGeneral = () => {
    navigate('/remisiones/general');
  };

  const exportarGeneral = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3000/remisiones/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) return;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `remisiones_general_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exportando:', error);
    }
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
          <h1 className="ps-titulo">Control de Remisiones y Existencias</h1>
          <p className="ps-subtitulo">Programa de Entregas - ALUBIN</p>
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
          <button className="ps-action-button ps-add-remision-button" onClick={() => setShowAgregarRemision(true)}>
            + Agregar Remisión
          </button>
          <button className="ps-action-button ps-historial-button" onClick={() => setShowHistorial(true)}>
            Historial Entregas
          </button>
          <button className="ps-action-button ps-primary-button" onClick={irAVistaGeneral}>
            Vista General
          </button>
          <button className="ps-action-button ps-success-button" onClick={exportarGeneral}>
            Exportar Todo
          </button>
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
                      <span className={`ps-estado-badge ${proyecto.estado}`}>
                        {proyecto.estado === 'en_progreso' ? 'En Progreso' : 'Completado'}
                      </span>
                    </div>
                    <span className="ps-card-arrow">Ver Remisiones &rarr;</span>
                  </li>
                );
              })}
              {proyectosFiltrados.length === 0 && (
                <li className="ps-empty-item">No se encontraron proyectos que coincidan con los filtros</li>
              )}
            </ul>
          </div>
        </section>
      </div>

      {/* Modals */}
      <AgregarRemisionModal
        isOpen={showAgregarRemision}
        onClose={() => setShowAgregarRemision(false)}
        onSuccess={() => {
          cargarDatos();
        }}
      />

      {showHistorial && (
        <HistorialEntregas onClose={() => setShowHistorial(false)} />
      )}
    </div>
  );
}
