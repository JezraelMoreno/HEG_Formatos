import { useState, useEffect } from 'react';
import { authHeader } from '../../auth';
import './HistorialEntregas.css';

interface EntregaHistorial {
    id_entrega: number;
    fecha_entrega: string;
    numero_pedido: string;
    nombre_proyecto: string;
    tipo_material: 'aluminio' | 'cristal' | 'miscelaneo';
    total_items: number;
    total_piezas: number;
    observaciones: string | null;
    usuario: string;
    ruta_pdf?: string | null;
}

interface HistorialEntregasProps {
    onClose?: () => void;
    inline?: boolean;
}

export function HistorialEntregas({ onClose, inline = false }: HistorialEntregasProps) {
    const [entregas, setEntregas] = useState<EntregaHistorial[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroMaterial, setFiltroMaterial] = useState<'todos' | 'aluminio' | 'cristal' | 'miscelaneo'>('todos');
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        cargarHistorial();
    }, []);

    const cargarHistorial = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/remisiones/historial-entregas', {
                headers: authHeader()
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setEntregas(json.data || []);
            }
        } catch (err) {
            console.error('Error cargando historial:', err);
        } finally {
            setLoading(false);
        }
    };

    const entregasFiltradas = entregas.filter(e => {
        const matchMaterial = filtroMaterial === 'todos' || e.tipo_material === filtroMaterial;
        const matchBusqueda =
            e.numero_pedido?.toLowerCase().includes(busqueda.toLowerCase()) ||
            e.nombre_proyecto?.toLowerCase().includes(busqueda.toLowerCase()) ||
            e.usuario?.toLowerCase().includes(busqueda.toLowerCase());
        return matchMaterial && matchBusqueda;
    });

    const formatDate = (fecha: string) => {
        return new Date(fecha).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const content = (
        <div className="he-container">
            {/* Header (only if not inline) */}
            {!inline && (
                <div className="he-header">
                    <h2 className="he-title">Historial de Entregas</h2>
                    {onClose && (
                        <button className="he-close-btn" onClick={onClose}>&times;</button>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="he-filters">
                <div className="he-search">
                    <input
                        type="text"
                        placeholder="Buscar por pedido, proyecto o usuario..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="he-filter-tabs">
                    <button
                        className={`he-filter-tab ${filtroMaterial === 'todos' ? 'active' : ''}`}
                        onClick={() => setFiltroMaterial('todos')}
                    >
                        Todos
                    </button>
                    <button
                        className={`he-filter-tab ${filtroMaterial === 'aluminio' ? 'active' : ''}`}
                        onClick={() => setFiltroMaterial('aluminio')}
                    >
                        Aluminio
                    </button>
                    <button
                        className={`he-filter-tab ${filtroMaterial === 'cristal' ? 'active' : ''}`}
                        onClick={() => setFiltroMaterial('cristal')}
                    >
                        Cristal
                    </button>
                    <button
                        className={`he-filter-tab ${filtroMaterial === 'miscelaneo' ? 'active' : ''}`}
                        onClick={() => setFiltroMaterial('miscelaneo')}
                    >
                        Misceláneos
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="he-stats">
                <div className="he-stat">
                    <span className="he-stat-value">{entregasFiltradas.length}</span>
                    <span className="he-stat-label">Entregas</span>
                </div>
                <div className="he-stat">
                    <span className="he-stat-value">
                        {entregasFiltradas.reduce((acc, e) => acc + e.total_piezas, 0)}
                    </span>
                    <span className="he-stat-label">Piezas Totales</span>
                </div>
            </div>

            {/* List */}
            <div className="he-list">
                {loading ? (
                    <div className="he-loading">Cargando historial...</div>
                ) : entregasFiltradas.length === 0 ? (
                    <div className="he-empty">
                        <p>No hay entregas registradas</p>
                    </div>
                ) : (
                    entregasFiltradas.map(e => (
                        <div key={e.id_entrega} className="he-item">
                            <div className="he-item-header">
                                <span className={`he-material-badge ${e.tipo_material}`}>
                                    {e.tipo_material === 'aluminio' ? 'AL' : e.tipo_material === 'cristal' ? 'CR' : 'MI'}
                                </span>
                                <span className="he-pedido">Pedido #{e.numero_pedido}</span>
                                <span className="he-fecha">{formatDate(e.fecha_entrega)}</span>
                            </div>
                            <div className="he-item-body">
                                <span className="he-proyecto">{e.nombre_proyecto}</span>
                                <div className="he-metrics">
                                    <span className="he-metric">
                                        <strong>{e.total_items}</strong> items
                                    </span>
                                    <span className="he-metric">
                                        <strong>{e.total_piezas}</strong> piezas
                                    </span>
                                </div>
                            </div>
                            <div className="he-item-footer">
                                <span className="he-usuario">Por: {e.usuario}</span>
                                {e.observaciones && (
                                    <span className="he-observaciones" title={e.observaciones}>
                                        {e.observaciones.length > 50
                                            ? e.observaciones.substring(0, 50) + '...'
                                            : e.observaciones}
                                    </span>
                                )}
                                {e.ruta_pdf && (
                                    <a
                                        href={`http://localhost:3000/uploads/remisiones/${e.ruta_pdf}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="he-pdf-link"
                                    >
                                        Ver PDF
                                    </a>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    if (inline) {
        return content;
    }

    return (
        <div className="he-overlay" onClick={onClose}>
            <div className="he-modal" onClick={e => e.stopPropagation()}>
                {content}
            </div>
        </div>
    );
}
