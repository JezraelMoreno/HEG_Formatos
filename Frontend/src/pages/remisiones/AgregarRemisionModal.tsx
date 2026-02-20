import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../../auth';
import './AgregarRemisionModal.css';

interface Proyecto {
    id_proyecto: number;
    nombre: string;
}

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
    tipo_material: 'aluminio' | 'cristal' | 'miscelaneo';
}

interface EntregaItem {
    id_detalle: number;
    descripcion: string;
    cantidad_entrega: number;
    cantidad_pedida: number;
    tipo_material: 'aluminio' | 'cristal' | 'miscelaneo';
}

type MaterialTab = 'aluminio' | 'cristal' | 'miscelaneo';

interface AgregarRemisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialProjectId?: string;
}

export function AgregarRemisionModal({ isOpen, onClose, onSuccess, initialProjectId }: AgregarRemisionModalProps) {
    // Step state
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Step 1: Project selection
    const [proyectos, setProyectos] = useState<Proyecto[]>([]);
    const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
    const [loadingProyectos, setLoadingProyectos] = useState(false);
    const [projectSearch, setProjectSearch] = useState('');

    // Step 2: Material selection and order search
    const [materialTab, setMaterialTab] = useState<MaterialTab>('aluminio');
    const [searchTerm, setSearchTerm] = useState('');
    const [familiaFilter, setFamiliaFilter] = useState('');
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
    const [pdfFile, setPdfFile] = useState<File | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setProjectSearch('');
            setSelectedProject(null);
            setMaterialTab('aluminio');
            setSearchTerm('');
            setFamiliaFilter('');
            setSelectedPedido(null);
            setDetalles([]);
            setEntregas([]);
            setObservaciones('');
            setPdfFile(null);
            cargarProyectos();
        }
    }, [isOpen]);

    // Load projects
    const cargarProyectos = async () => {
        setLoadingProyectos(true);
        try {
            const res = await fetch('http://localhost:3000/proyectos', { headers: authHeader() });
            const json = await res.json();
            if (res.ok && json.success) {
                const data = json.data || [];
                setProyectos(data);

                // If initial ID provided, auto-select
                if (initialProjectId) {
                    const p = data.find((proj: Proyecto) => proj.id_proyecto === parseInt(initialProjectId));
                    if (p) {
                        setSelectedProject(p);
                        setStep(2);
                    }
                }
            }
        } catch (err) {
            console.error('Error cargando proyectos:', err);
        } finally {
            setLoadingProyectos(false);
        }
    };

    // Search pedidos
    const buscarPedidos = useCallback(async () => {
        const searchParam = searchTerm.trim();
        setLoadingPedidos(true);
        try {
            const projectIdParam = selectedProject ? `&id_proyecto=${selectedProject.id_proyecto}` : '';
            const familiaParam = familiaFilter.trim() ? `&familia=${encodeURIComponent(familiaFilter.trim())}` : '';
            const res = await fetch(
                `http://localhost:3000/remisiones/buscar-pedidos?tipo=${materialTab}&search=${encodeURIComponent(searchParam)}${projectIdParam}${familiaParam}`,
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
    }, [searchTerm, familiaFilter, materialTab]);

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
                setStep(3);
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
        if (!pdfFile) {
            alert('Debe adjuntar un PDF para registrar la remisión');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('id_pedido', String(selectedPedido?.id));
            formData.append('tipo_material', materialTab);
            formData.append('entregas', JSON.stringify(entregasConCantidad));
            formData.append('observaciones', observaciones);
            formData.append('pdf', pdfFile);

            const res = await fetch('http://localhost:3000/remisiones/registrar-entrega', {
                method: 'POST',
                headers: authHeader(), // SIN Content-Type, FormData lo pone automáticamente
                body: formData
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
                        {step === 1 && 'Agregar Remisión - Seleccionar Proyecto'}
                        {step === 2 && 'Agregar Remisión - Buscar Pedido'}
                        {step === 3 && 'Agregar Remisión - Registrar Entrega'}
                        {step === 4 && 'Agregar Remisión - Confirmar'}
                    </h2>
                    <button className="arm-close-btn" onClick={onClose}>&times;</button>
                </div>

                {/* Progress */}
                <div className="arm-progress">
                    <div className={`arm-progress-step ${step >= 1 ? 'active' : ''}`}>
                        <span className="arm-step-number">1</span>
                        <span className="arm-step-label">Proyecto</span>
                    </div>
                    <div className="arm-progress-line" />
                    <div className={`arm-progress-step ${step >= 2 ? 'active' : ''}`}>
                        <span className="arm-step-number">2</span>
                        <span className="arm-step-label">Pedido</span>
                    </div>
                    <div className="arm-progress-line" />
                    <div className={`arm-progress-step ${step >= 3 ? 'active' : ''}`}>
                        <span className="arm-step-number">3</span>
                        <span className="arm-step-label">Entrega</span>
                    </div>
                    <div className="arm-progress-line" />
                    <div className={`arm-progress-step ${step >= 4 ? 'active' : ''}`}>
                        <span className="arm-step-number">4</span>
                        <span className="arm-step-label">Confirmar</span>
                    </div>
                </div>

                {/* Content */}
                <div className="arm-content">
                    {/* Step 1: Select Project */}
                    {step === 1 && (
                        <div className="arm-step-content">
                            <div className="arm-search-box">
                                <input
                                    type="text"
                                    placeholder="Filtrar proyectos por nombre..."
                                    value={projectSearch}
                                    onChange={e => setProjectSearch(e.target.value)}
                                    autoFocus
                                />
                                {loadingProyectos && <span className="arm-loading-indicator">Cargando...</span>}
                            </div>
                            <div className="arm-results-list">
                                {proyectos
                                    .filter(p => p.nombre.toLowerCase().includes(projectSearch.toLowerCase()))
                                    .map(p => (
                                        <div
                                            key={p.id_proyecto}
                                            className={`arm-result-item ${selectedProject?.id_proyecto === p.id_proyecto ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedProject(p);
                                                setStep(2);
                                            }}
                                        >
                                            <div className="arm-result-main">
                                                <span className="arm-result-proyecto">{p.nombre}</span>
                                            </div>
                                        </div>
                                    ))}
                                {proyectos.length === 0 && !loadingProyectos && (
                                    <p className="arm-no-results">No hay proyectos disponibles</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Search Order */}
                    {step === 2 && (
                        <div className="arm-step-content">
                            <div className="arm-selected-project-info">
                                Proyecto seleccionado: <strong>{selectedProject?.nombre}</strong>
                                <button className="arm-change-btn" onClick={() => setStep(1)}>Cambiar</button>
                            </div>

                            <div className="arm-material-tabs">
                                <button
                                    className={`arm-material-tab ${materialTab === 'aluminio' ? 'active' : ''}`}
                                    onClick={() => { setMaterialTab('aluminio'); setPedidos([]); setFamiliaFilter(''); }}
                                >
                                    Aluminio
                                </button>
                                <button
                                    className={`arm-material-tab ${materialTab === 'cristal' ? 'active' : ''}`}
                                    onClick={() => { setMaterialTab('cristal'); setPedidos([]); setFamiliaFilter(''); }}
                                >
                                    Cristal
                                </button>
                                <button
                                    className={`arm-material-tab ${materialTab === 'miscelaneo' ? 'active' : ''}`}
                                    onClick={() => { setMaterialTab('miscelaneo'); setPedidos([]); setFamiliaFilter(''); }}
                                >
                                    Misceláneos
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
                            <div className="arm-search-box">
                                <input
                                    type="text"
                                    placeholder="Filtrar por familia (ej. AL, CR, VN)..."
                                    value={familiaFilter}
                                    onChange={e => setFamiliaFilter(e.target.value)}
                                />
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

                    {/* Step 3: Register deliveries */}
                    {step === 3 && (
                        <div className="arm-step-content">
                            <div className="arm-selected-order">
                                <span className="arm-order-badge">{materialTab === 'aluminio' ? 'AL' : materialTab === 'cristal' ? 'CR' : 'MI'}</span>
                                <span className="arm-order-info">
                                    Pedido <strong>#{selectedPedido?.numero_pedido}</strong>
                                    {' - '}
                                    {selectedProject?.nombre}
                                </span>
                                <button className="arm-change-btn" onClick={() => setStep(2)}>Cambiar</button>
                            </div>

                            {loadingDetalles ? (
                                <div className="arm-loading">Cargando detalles...</div>
                            ) : detalles.length === 0 ? (
                                <div className="arm-no-results">
                                    <p>Este pedido no tiene conceptos o partidas registradas para el tipo de material seleccionado.</p>
                                    <button className="arm-btn arm-btn-secondary" onClick={() => setStep(2)}>
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

                    {/* Step 4: Confirm */}
                    {step === 4 && (
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

                                <div className="arm-pdf-upload">
                                    <label>Adjuntar PDF *</label>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => setPdfFile(e.target.files?.[0] || null)}
                                    />
                                    {pdfFile && (
                                        <span className="arm-pdf-name">{pdfFile.name}</span>
                                    )}
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
                            onClick={() => setStep((step - 1) as 1 | 2 | 3)}
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
                    {step === 3 && (
                        <button
                            className="arm-btn arm-btn-primary"
                            onClick={() => setStep(4)}
                            disabled={totalItems === 0}
                        >
                            Continuar →
                        </button>
                    )}
                    {step === 4 && (
                        <button
                            className="arm-btn arm-btn-success"
                            onClick={guardarEntregas}
                            disabled={saving || !pdfFile}
                        >
                            {saving ? 'Guardando...' : '✓ Confirmar Entrega'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
