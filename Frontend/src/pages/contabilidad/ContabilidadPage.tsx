import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton } from '../../components/BackButton';
import { authHeader } from '../../auth';
import './ContabilidadPage.css';
import API_URL from '../../config';

interface Factura {
    id_factura: number;
    id_proyecto: number;
    proveedor: string;
    concepto: string;
    categoria: 'materiales' | 'mano_de_obra' | 'flete' | 'otro';
    total: number;
    fecha_factura: string;
    estatus: 'pendiente' | 'pagada' | 'cancelada';
    fecha_pago: string | null;
    metodo_pago: string | null;
    ruta_pdf: string;
    ruta_xml: string | null;
    nombre_usuario: string | null;
    created_at: string;
}

const CATEGORIA_LABELS: Record<string, string> = {
    materiales: 'Materiales',
    mano_de_obra: 'Mano de Obra',
    flete: 'Flete',
    otro: 'Otro',
};

const formatCurrency = (n: number) =>
    `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-MX') : '-';

// ---------------------------------------------------------------------------
// Modal: Agregar Factura
// ---------------------------------------------------------------------------
interface AgregarFacturaModalProps {
    projectId: string;
    onClose: () => void;
    onSuccess: () => void;
}

function AgregarFacturaModal({ projectId, onClose, onSuccess }: AgregarFacturaModalProps) {
    const [proveedor, setProveedor] = useState('');
    const [concepto, setConcepto] = useState('');
    const [categoria, setCategoria] = useState<string>('materiales');
    const [total, setTotal] = useState('');
    const [fechaFactura, setFechaFactura] = useState('');
    const [estatus, setEstatus] = useState('pendiente');
    const [fechaPago, setFechaPago] = useState('');
    const [metodoPago, setMetodoPago] = useState('');
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [xmlFile, setXmlFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!pdfFile) {
            setError('El PDF es obligatorio.');
            return;
        }
        if (!proveedor || !concepto || !total || !fechaFactura) {
            setError('Completa todos los campos requeridos.');
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('id_proyecto', projectId);
            formData.append('proveedor', proveedor);
            formData.append('concepto', concepto);
            formData.append('categoria', categoria);
            formData.append('total', total);
            formData.append('fecha_factura', fechaFactura);
            formData.append('estatus', estatus);
            if (fechaPago) formData.append('fecha_pago', fechaPago);
            if (metodoPago) formData.append('metodo_pago', metodoPago);
            formData.append('pdf', pdfFile);
            if (xmlFile) formData.append('xml', xmlFile);

            const res = await fetch(`${API_URL}/facturas`, {
                method: 'POST',
                headers: authHeader(),
                body: formData,
            });
            const json = await res.json();
            if (res.ok && json.success) {
                onSuccess();
            } else {
                setError(json.message || 'Error al guardar la factura.');
            }
        } catch {
            setError('Error de conexión.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="cnt-overlay" onClick={onClose}>
            <div className="cnt-modal" onClick={e => e.stopPropagation()}>
                <div className="cnt-modal-header">
                    <h2>Agregar Factura</h2>
                    <button className="cnt-close-btn" onClick={onClose}>&times;</button>
                </div>
                <form className="cnt-form" onSubmit={handleSubmit}>
                    {error && <div className="cnt-form-error">{error}</div>}

                    <div className="cnt-form-row">
                        <div className="cnt-form-group">
                            <label>Proveedor *</label>
                            <input
                                type="text"
                                value={proveedor}
                                onChange={e => setProveedor(e.target.value)}
                                placeholder="Nombre del proveedor"
                                required
                            />
                        </div>
                        <div className="cnt-form-group">
                            <label>Categoría *</label>
                            <select value={categoria} onChange={e => setCategoria(e.target.value)}>
                                <option value="materiales">Materiales</option>
                                <option value="mano_de_obra">Mano de Obra</option>
                                <option value="flete">Flete</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    <div className="cnt-form-group">
                        <label>Concepto *</label>
                        <input
                            type="text"
                            value={concepto}
                            onChange={e => setConcepto(e.target.value)}
                            placeholder="Descripción del gasto"
                            required
                        />
                    </div>

                    <div className="cnt-form-row">
                        <div className="cnt-form-group">
                            <label>Total *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={total}
                                onChange={e => setTotal(e.target.value)}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div className="cnt-form-group">
                            <label>Fecha Factura *</label>
                            <input
                                type="date"
                                value={fechaFactura}
                                onChange={e => setFechaFactura(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="cnt-form-row">
                        <div className="cnt-form-group">
                            <label>Estatus</label>
                            <select value={estatus} onChange={e => setEstatus(e.target.value)}>
                                <option value="pendiente">Pendiente</option>
                                <option value="pagada">Pagada</option>
                                <option value="cancelada">Cancelada</option>
                            </select>
                        </div>
                        <div className="cnt-form-group">
                            <label>Método de Pago</label>
                            <input
                                type="text"
                                value={metodoPago}
                                onChange={e => setMetodoPago(e.target.value)}
                                placeholder="Transferencia, cheque..."
                            />
                        </div>
                    </div>

                    {estatus === 'pagada' && (
                        <div className="cnt-form-group">
                            <label>Fecha de Pago</label>
                            <input
                                type="date"
                                value={fechaPago}
                                onChange={e => setFechaPago(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="cnt-form-row">
                        <div className="cnt-form-group">
                            <label>PDF *</label>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={e => setPdfFile(e.target.files?.[0] || null)}
                            />
                            {pdfFile && <span className="cnt-file-selected">{pdfFile.name}</span>}
                        </div>
                        <div className="cnt-form-group">
                            <label>XML (opcional)</label>
                            <input
                                type="file"
                                accept=".xml"
                                onChange={e => setXmlFile(e.target.files?.[0] || null)}
                            />
                            {xmlFile && <span className="cnt-file-selected">{xmlFile.name}</span>}
                        </div>
                    </div>

                    <div className="cnt-modal-footer">
                        <button type="button" className="cnt-btn cnt-btn-secondary" onClick={onClose} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="cnt-btn cnt-btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Factura'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Modal: Editar Estatus de Factura
// ---------------------------------------------------------------------------
interface EditarFacturaModalProps {
    factura: Factura;
    onClose: () => void;
    onSuccess: () => void;
}

function EditarFacturaModal({ factura, onClose, onSuccess }: EditarFacturaModalProps) {
    const [estatus, setEstatus] = useState(factura.estatus);
    const [fechaPago, setFechaPago] = useState(factura.fecha_pago || '');
    const [metodoPago, setMetodoPago] = useState(factura.metodo_pago || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/facturas/${factura.id_factura}`, {
                method: 'PUT',
                headers: { ...authHeader(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ estatus, fecha_pago: fechaPago || null, metodo_pago: metodoPago || null }),
            });
            const json = await res.json();
            if (res.ok && json.success) {
                onSuccess();
            } else {
                setError(json.message || 'Error al actualizar.');
            }
        } catch {
            setError('Error de conexión.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="cnt-overlay" onClick={onClose}>
            <div className="cnt-modal cnt-modal-sm" onClick={e => e.stopPropagation()}>
                <div className="cnt-modal-header">
                    <h2>Actualizar Estatus</h2>
                    <button className="cnt-close-btn" onClick={onClose}>&times;</button>
                </div>
                <form className="cnt-form" onSubmit={handleSubmit}>
                    {error && <div className="cnt-form-error">{error}</div>}
                    <div className="cnt-form-group">
                        <label>Proveedor</label>
                        <input type="text" value={factura.proveedor} disabled />
                    </div>
                    <div className="cnt-form-group">
                        <label>Estatus *</label>
                        <select value={estatus} onChange={e => setEstatus(e.target.value as Factura['estatus'])}>
                            <option value="pendiente">Pendiente</option>
                            <option value="pagada">Pagada</option>
                            <option value="cancelada">Cancelada</option>
                        </select>
                    </div>
                    {estatus === 'pagada' && (
                        <>
                            <div className="cnt-form-group">
                                <label>Fecha de Pago</label>
                                <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} />
                            </div>
                            <div className="cnt-form-group">
                                <label>Método de Pago</label>
                                <input
                                    type="text"
                                    value={metodoPago}
                                    onChange={e => setMetodoPago(e.target.value)}
                                    placeholder="Transferencia, cheque..."
                                />
                            </div>
                        </>
                    )}
                    <div className="cnt-modal-footer">
                        <button type="button" className="cnt-btn cnt-btn-secondary" onClick={onClose} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="submit" className="cnt-btn cnt-btn-primary" disabled={saving}>
                            {saving ? 'Guardando...' : 'Actualizar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Página principal de Contabilidad
// ---------------------------------------------------------------------------
export function ContabilidadPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [editando, setEditando] = useState<Factura | null>(null);
    const [filtroEstatus, setFiltroEstatus] = useState<string>('todos');
    const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

    const cargarFacturas = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/facturas?id_proyecto=${projectId}`, {
                headers: authHeader(),
            });
            const json = await res.json();
            if (res.ok && json.success) {
                setFacturas(json.data || []);
            } else {
                setError(json.message || 'Error cargando facturas.');
            }
        } catch {
            setError('Error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargarFacturas(); }, [projectId]);

    const eliminarFactura = async (id_factura: number) => {
        if (!confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
        try {
            const res = await fetch(`${API_URL}/facturas/${id_factura}`, {
                method: 'DELETE',
                headers: authHeader(),
            });
            const json = await res.json();
            if (res.ok && json.success) {
                cargarFacturas();
            } else {
                alert(json.message || 'Error al eliminar.');
            }
        } catch {
            alert('Error de conexión.');
        }
    };

    const facturasFiltradas = facturas.filter(f => {
        const matchEstatus = filtroEstatus === 'todos' || f.estatus === filtroEstatus;
        const matchCategoria = filtroCategoria === 'todos' || f.categoria === filtroCategoria;
        return matchEstatus && matchCategoria;
    });

    const totalGeneral = facturasFiltradas.reduce((s, f) => s + Number(f.total), 0);
    const totalPendiente = facturasFiltradas
        .filter(f => f.estatus === 'pendiente')
        .reduce((s, f) => s + Number(f.total), 0);

    return (
        <div className="cnt-page">
            {/* Header */}
            <div className="cnt-header">
                <BackButton />
                <h1 className="cnt-title">Facturas del Proyecto</h1>
                <button className="cnt-btn cnt-btn-primary" onClick={() => setModalAbierto(true)}>
                    + Agregar Factura
                </button>
            </div>

            {/* Cards resumen */}
            <div className="cnt-summary">
                <div className="cnt-summary-card">
                    <span className="cnt-summary-value">{facturasFiltradas.length}</span>
                    <span className="cnt-summary-label">Facturas</span>
                </div>
                <div className="cnt-summary-card">
                    <span className="cnt-summary-value">{formatCurrency(totalGeneral)}</span>
                    <span className="cnt-summary-label">Total</span>
                </div>
                <div className="cnt-summary-card cnt-summary-card--warning">
                    <span className="cnt-summary-value">{formatCurrency(totalPendiente)}</span>
                    <span className="cnt-summary-label">Por Pagar</span>
                </div>
            </div>

            {/* Filtros */}
            <div className="cnt-filters">
                <div className="cnt-filter-group">
                    <label>Estatus:</label>
                    <select value={filtroEstatus} onChange={e => setFiltroEstatus(e.target.value)}>
                        <option value="todos">Todos</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pagada">Pagada</option>
                        <option value="cancelada">Cancelada</option>
                    </select>
                </div>
                <div className="cnt-filter-group">
                    <label>Categoría:</label>
                    <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}>
                        <option value="todos">Todas</option>
                        <option value="materiales">Materiales</option>
                        <option value="mano_de_obra">Mano de Obra</option>
                        <option value="flete">Flete</option>
                        <option value="otro">Otro</option>
                    </select>
                </div>
            </div>

            {/* Tabla */}
            {loading ? (
                <div className="cnt-loading">Cargando facturas...</div>
            ) : error ? (
                <div className="cnt-error">{error}</div>
            ) : facturasFiltradas.length === 0 ? (
                <div className="cnt-empty">
                    No hay facturas registradas para este proyecto.
                </div>
            ) : (
                <div className="cnt-table-wrapper">
                    <table className="cnt-table">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Concepto</th>
                                <th>Categoría</th>
                                <th>Total</th>
                                <th>Fecha Factura</th>
                                <th>Estatus</th>
                                <th>Fecha Pago</th>
                                <th>Método Pago</th>
                                <th>Archivos</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {facturasFiltradas.map(f => (
                                <tr key={f.id_factura} className={`cnt-row cnt-row--${f.estatus}`}>
                                    <td>{f.proveedor}</td>
                                    <td className="cnt-concepto" title={f.concepto}>{f.concepto}</td>
                                    <td>{CATEGORIA_LABELS[f.categoria] || f.categoria}</td>
                                    <td className="cnt-total">{formatCurrency(Number(f.total))}</td>
                                    <td>{formatDate(f.fecha_factura)}</td>
                                    <td>
                                        <span className={`cnt-badge cnt-badge--${f.estatus}`}>
                                            {f.estatus.charAt(0).toUpperCase() + f.estatus.slice(1)}
                                        </span>
                                    </td>
                                    <td>{formatDate(f.fecha_pago)}</td>
                                    <td>{f.metodo_pago || '-'}</td>
                                    <td className="cnt-files">
                                        <a
                                            href={`${API_URL}/uploads/${f.ruta_pdf}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="cnt-file-link cnt-file-link--pdf"
                                        >
                                            PDF
                                        </a>
                                        {f.ruta_xml && (
                                            <a
                                                href={`${API_URL}/uploads/${f.ruta_xml}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="cnt-file-link cnt-file-link--xml"
                                            >
                                                XML
                                            </a>
                                        )}
                                    </td>
                                    <td className="cnt-actions">
                                        <button
                                            className="cnt-btn-sm cnt-btn-sm--edit"
                                            onClick={() => setEditando(f)}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className="cnt-btn-sm cnt-btn-sm--delete"
                                            onClick={() => eliminarFactura(f.id_factura)}
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modales */}
            {modalAbierto && (
                <AgregarFacturaModal
                    projectId={projectId!}
                    onClose={() => setModalAbierto(false)}
                    onSuccess={() => { setModalAbierto(false); cargarFacturas(); }}
                />
            )}
            {editando && (
                <EditarFacturaModal
                    factura={editando}
                    onClose={() => setEditando(null)}
                    onSuccess={() => { setEditando(null); cargarFacturas(); }}
                />
            )}
        </div>
    );
}
