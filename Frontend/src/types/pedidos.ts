export type EstadoPedido = "levantado" | "aprobado" | "rechazado";

export type TipoDetalle = "cristal" | "aluminio" | "miscelaneos";

export type Pedido = {
  id: number;
  id_proyecto: number;
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  proveedor: string;
  nombre_usuario?: string | null;
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string | null;
  importe: number;
  porcentaje_descuento?: number | null;
  estado: EstadoPedido;
  id_aprobador?: number | null;
  fecha_levantado?: string | null;
  fecha_resolucion?: string | null;
};

export type PedidoDetalleItem = {
  id_detalle: number;
  descripcion: string;
  unidad?: string | null;
  medida?: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  clave?: string | null;
  ml?: number | null;
  acabado?: string | null;
  kg?: number | null;
  precio_x_kg?: number | null;
};

export type PedidoDetalleCristalItem = {
  id_detalle: number;
  descripcion: string;
  clave_modelo?: string | null;
  ancho?: number | null;
  largo?: number | null;
  m2_corte?: number | null;
  piezas: number;
  m2_pedido?: number | null;
  precio_unitario: number;
  importe: number;
};

export type PedidoDetalleAluminioItem = {
  id_detalle: number;
  descripcion: string;
  numero_perfil?: string | null;
  medida_tramo?: number | null;
  unidad?: string | null;
  peso_kg_ml?: number | null;
  perimetro_m2_ml?: number | null;
  acabado?: string | null;
  total_tramos?: number | null;
  ml?: number | null;
  kg?: number | null;
  m2?: number | null;
  importe: number;
};

export type DetalleUnion = PedidoDetalleItem | PedidoDetalleCristalItem | PedidoDetalleAluminioItem;

export type HistorialEstadoItem = {
  id: number;
  id_pedido: number;
  estado_anterior: EstadoPedido | null;
  estado_nuevo: EstadoPedido;
  comentario?: string | null;
  fecha_registro: string;
  nombre_usuario: string;
};
