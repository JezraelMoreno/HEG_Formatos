import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../auth';
import './AgregarRemisionModal.css';

interface Pedido {
    id: number;
    numero_pedido: string;
    nombre_proyecto: string;
    proveedor: string;
    familia: string;
}

interface DetallePedido {
    id_detalle: number;
    numero_perfil?: string;
    clave_modelo?: string;
    descripcion: string;
    cantidad_disponible: number;
    cantidad_pedida: number;
    cantidad_recibida: number;
    tipo_material: 'aluminio' | 'cristal';
}

interface EntregaItem {
    id_detalle: number;
    descripcion: string;
    cantidad_entrega: number;
    cantidad_pedida: number;
    tipo_material: 'aluminio' | 'cristal';
}

type MaterialTab = 'aluminio' | 'cristal';

interface AgregarRemisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AgregarRemisionModal({ isOpen, onClose, onSuccess }: AgregarRemisionModalProps) {
    // Step state
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1: Material selection and order search
    const [materialTab, setMaterialTab] = useState<MaterialTab>('aluminio');
    const [searchTerm, setSearchTerm] = useState('');
    const [pedidos, setPedidos] = useState<Pedido[]>([]);
    const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
    const [loadingPedidos, setLoadingPedidos] = useState(false);

    // Step 2: Select items to deliver
    const [detalles, setDetalles] = useState<DetallePedido[]>([]);
    const [loadingDetalles, setLoadingDetalles] = useState(false);
    const [entregas, setEntregas] = useState<EntregaItem[]>([]);

    // Step 3: Confirm
    const [saving, setSaving] = useState(false);
    const [observaciones, setObservaciones] = useState('');

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setSearchTerm('');
            setSelectedPedido(null);
            setDetalles([]);
            setEntregas([]);
            setObservaciones('');
        }
    }, [isOpen]);

    // Search pedidos
    const buscarPedidos = useCallback(async () => {
        const searchParam = searchTerm.trim();
        setLoadingPedidos(true);
        try {
            const res = await fetch(
                `http://localhost:3000/remisiones/buscar-pedidos?tipo=${materialTab}&search=${encodeURIComponent(searchParam)}`,
                { headers: authHeader() }
            );
            const json = await res.json();
            if (res.ok && json.success) {
                setPedidos(json.data || []);
            }
        } catch (err) {
            console.error('Error buscando pedidos:', err);
        } finally {
            setLoadingPedidos(false);
        }
    }, [searchTerm, materialTab]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            buscarPedidos();
        }, 300);
        return () => clearTimeout(timer);
    }, [buscarPedidos]);

    // Load order details when selected
    const cargarDetalles = async (pedido: Pedido) => {
        setLoadingDetalles(true);
        setSelectedPedido(pedido);
        try {
            const res = await fetch(
                `http://localhost:3000/remisiones/detalles-pedido/${pedido.id}?tipo=${materialTab}`,
                { headers: authHeader() }
            );
            const json = await res.json();
            if (res.ok && json.success) {
                setDetalles(json.data || []);
                setEntregas(
                    (json.data || []).map((d: DetallePedido) => ({
                        id_detalle: d.id_detalle,
                        descripcion: d.descripcion,
                        cantidad_entrega: 0,
                        cantidad_pedida: d.cantidad_pedida,
                        tipo_material: materialTab
                    }))
                );
                setStep(2);
            }
        } catch (err) {
            console.error('Error cargando detalles:', err);
        } finally {
            setLoadingDetalles(false);
        }
    };

    // Update entrega quantity
    const updateEntregaCantidad = (id_detalle: number, cantidad: number) => {
        setEntregas(prev =>
            prev.map(e =>
                e.id_detalle === id_detalle
                    ? { ...e, cantidad_entrega: Math.max(0, cantidad) }
                    : e
            )
        );
    };

    // Calculate totals
    const entregasConCantidad = entregas.filter(e => e.cantidad_entrega > 0);
    const totalItems = entregasConCantidad.length;
    const totalPiezas = entregasConCantidad.reduce((acc, e) => acc + e.cantidad_entrega, 0);

    // Save entregas
    const guardarEntregas = async () => {
        if (entregasConCantidad.length === 0) {
            alert('Debe ingresar al menos una entrega');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('http://localhost:3000/remisiones/registrar-entrega', {
                method: 'POST',
                headers: { ...authHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_pedido: selectedPedido?.id,
                    tipo_material: materialTab,
                    entregas: entregasConCantidad,
                    observaciones
                })
            });

            const json = await res.json();
            if (res.ok && json.success) {
                onSuccess();
                onClose();
            } else {
                alert(json.message || 'Error al registrar entregas');
            }
        } catch (err) {
            console.error('Error guardando entregas:', err);
            alert('Error al registrar entregas');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="arm-overlay" onClick={onClose}>
            <div className="arm-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="arm-header">
                    <h2 className="arm-title">
                        {step === 1 && 'Agregar Remisión - Buscar Pedido'}
                        {step === 2 && 'Agregar Remisión - Registrar Entrega'}
                        {step === 3 && 'Agregar Remisión - Confirmar'}
                    </h2>
                    <button className="arm-close-btn" onClick={onClose}>&times;</button>
                </div>

                {/* Progress */}
                <div className="arm-progress">
                    <div className={`arm-progress-step ${step >= 1 ? 'active' : ''}`}>
                        <span className="arm-step-number">1</span>
                        <span className="arm-step-label">Buscar Pedido</span>
                    </div>
                    <div className="arm-progress-line" />
                    <div className={`arm-progress-step ${step >= 2 ? 'active' : ''}`}>
                        <span className="arm-step-number">2</span>
                        <span className="arm-step-label">Registrar Entrega</span>
                    </div>
                    <div className="arm-progress-line" />
                    <div className={`arm-progress-step ${step >= 3 ? 'active' : ''}`}>
                        <span className="arm-step-number">3</span>
                        <span className="arm-step-label">Confirmar</span>
                    </div>
                </div>

                {/* Content */}
                <div className="arm-content">
                    {/* Step 1: Search */}
                    {step === 1 && (
                        <div className="arm-step-content">
                            <div className="arm-material-tabs">
                                <button
                                    className={`arm-material-tab ${materialTab === 'aluminio' ? 'active' : ''}`}
                                    onClick={() => { setMaterialTab('aluminio'); setPedidos([]); }}
                                >
                                    Aluminio
                                </button>
                                <button
                                    className={`arm-material-tab ${materialTab === 'cristal' ? 'active' : ''}`}
                                    onClick={() => { setMaterialTab('cristal'); setPedidos([]); }}
                                >
                                    Cristal
                                </button>
                            </div>

                            <div className="arm-search-box">
                                <input
                                    type="text"
                                    placeholder="Buscar por número de pedido, proyecto o proveedor..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                                {loadingPedidos && <span className="arm-loading-indicator">Buscando...</span>}
                            </div>

                            <div className="arm-results-list">
                                {pedidos.length === 0 && searchTerm && !loadingPedidos && (
                                    <p className="arm-no-results">No se encontraron pedidos</p>
                                )}
                                {pedidos.map(p => (
                                    <div
                                        key={p.id}
                                        className="arm-result-item"
                                        onClick={() => cargarDetalles(p)}
                                    >
                                        <div className="arm-result-main">
                                            <span className="arm-result-pedido">Pedido #{p.numero_pedido}</span>
                                            <span className="arm-result-proyecto">{p.nombre_proyecto}</span>
                                        </div>
                                        <div className="arm-result-meta">
                                            <span className="arm-result-proveedor">{p.proveedor}</span>
                                            <span className="arm-result-familia">{p.familia}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Register deliveries */}
                    {step === 2 && (
                        <div className="arm-step-content">
                            <div className="arm-selected-order">
                                <span className="arm-order-badge">{materialTab === 'aluminio' ? 'AL' : 'CR'}</span>
                                <span className="arm-order-info">
                                    Pedido <strong>#{selectedPedido?.numero_pedido}</strong>
                                    {' - '}
                                    {selectedPedido?.nombre_proyecto}
                                </span>
                                <button className="arm-change-btn" onClick={() => setStep(1)}>Cambiar</button>
                            </div>

                            {loadingDetalles ? (
                                <div className="arm-loading">Cargando detalles...</div>
                            ) : detalles.length === 0 ? (
                                <div className="arm-no-results">
                                    <p>Este pedido no tiene conceptos o partidas registradas para el tipo de material seleccionado.</p>
                                    <button className="arm-btn arm-btn-secondary" onClick={() => setStep(1)}>
                                        Volver a buscar
                                    </button>
                                </div>
                            ) : (
                                <div className="arm-detalles-table-wrapper">
                                    <table className="arm-detalles-table">
                                        <thead>
                                            <tr>
                                                <th>Perfil/Clave</th>
                                                <th>Descripción</th>
                                                <th>Pedido</th>
                                                <th>Recibido</th>
                                                <th>Pendiente</th>
                                                <th>Entrega</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalles.map(d => {
                                                const entrega = entregas.find(e => e.id_detalle === d.id_detalle);
                                                const pendiente = d.cantidad_pedida - d.cantidad_recibida;
                                                return (
                                                    <tr key={d.id_detalle} className={pendiente <= 0 ? 'completo' : ''}>
                                                        <td className="perfil-col">
                                                            {d.numero_perfil || d.clave_modelo || '-'}
                                                        </td>
                                                        <td className="desc-col">{d.descripcion}</td>
                                                        <td className="num-col">{d.cantidad_pedida}</td>
                                                        <td className="num-col">{d.cantidad_recibida}</td>
                                                        <td className={`num-col ${pendiente > 0 ? 'pendiente' : 'ok'}`}>
                                                            {pendiente}
                                                        </td>
                                                        <td className="input-col">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                max={pendiente}
                                                                value={entrega?.cantidad_entrega || 0}
                                                                onChange={e =>
                                                                    updateEntregaCantidad(
                                                                        d.id_detalle,
                                                                        parseInt(e.target.value, 10) || 0
                                                                    )
                                                                }
                                                                disabled={pendiente <= 0}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="arm-summary">
                                <span className="arm-summary-label">Resumen de entrega:</span>
                                <span className="arm-summary-value">
                                    <strong>{totalItems}</strong> items,{' '}
                                    <strong>{totalPiezas}</strong> piezas
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm */}
                    {step === 3 && (
                        <div className="arm-step-content">
                            <div className="arm-confirm-section">
                                <h3>Resumen de Entrega</h3>
                                <div className="arm-confirm-info">
                                    <p><strong>Pedido:</strong> #{selectedPedido?.numero_pedido}</p>
                                    <p><strong>Proyecto:</strong> {selectedPedido?.nombre_proyecto}</p>
                                    <p><strong>Material:</strong> {materialTab === 'aluminio' ? 'Aluminio' : 'Cristal'}</p>
                                    <p><strong>Total Items:</strong> {totalItems}</p>
                                    <p><strong>Total Piezas:</strong> {totalPiezas}</p>
                                </div>

                                <div className="arm-entregas-list">
                                    <h4>Entregas a registrar:</h4>
                                    <ul>
                                        {entregasConCantidad.map(e => (
                                            <li key={e.id_detalle}>
                                                <span className="arm-entrega-desc">{e.descripcion}</span>
                                                <span className="arm-entrega-qty">+{e.cantidad_entrega}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="arm-observaciones">
                                    <label>Observaciones (opcional):</label>
                                    <textarea
                                        placeholder="Añadir notas sobre esta entrega..."
                                        value={observaciones}
                                        onChange={e => setObservaciones(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="arm-footer">
                    {step > 1 && (
                        <button
                            className="arm-btn arm-btn-secondary"
                            onClick={() => setStep((step - 1) as 1 | 2)}
                            disabled={saving}
                        >
                            ← Anterior
                        </button>
                    )}
                    <div className="arm-footer-spacer" />
                    {step === 1 && (
                        <button className="arm-btn arm-btn-secondary" onClick={onClose}>
                            Cancelar
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            className="arm-btn arm-btn-primary"
                            onClick={() => setStep(3)}
                            disabled={totalItems === 0}
                        >
                            Continuar →
                        </button>
                    )}
                    {step === 3 && (
                        <button
                            className="arm-btn arm-btn-success"
                            onClick={guardarEntregas}
                            disabled={saving}
                        >
                            {saving ? 'Guardando...' : '✓ Confirmar Entrega'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
