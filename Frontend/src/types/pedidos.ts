export type EstadoPedido = "levantado" | "aprobado" | "rechazado";

export type TipoDetalle = "cristal" | "aluminio" | "miscelaneos";

export type SaldoAnticipo = {
  monto_total: number;
  monto_aplicado: number;
  saldo_disponible: number;
};

export type AnticipoDisponible = {
  id: number;
  pedido: string;
  proveedor: string;
  monto_total: number;
  monto_aplicado: number;
  saldo_disponible: number;
};

export type AplicacionAnticipo = {
  id: number;
  id_pedido_destino?: number;
  pedido_destino?: string;
  concepto_destino?: string;
  id_pedido_anticipo?: number;
  pedido_anticipo?: string;
  monto_aplicado: number;
  fecha_registro: string;
  nombre_usuario?: string;
};

export type Pedido = {
  id: number;
  id_proyecto: number;
  nombre_proyecto: string;
  pedido: string;
  clan: string;
  familia: string;
  es_anticipo: boolean;
  proveedor: string;
  nombre_usuario?: string | null;
  fecha_aprobacion: string; // YYYY-MM-DD
  concepto: string;
  situaciones_especiales?: string | null;
  descripcion_general?: string | null;
  importe: number;
  monto_cubierto_anticipo?: number;
  porcentaje_descuento?: number | null;
  moneda_aluminio?: "USD" | "MXN";
  tipo_cambio?: number | null;
  precio_aluminio_kg?: number | null;
  precio_pintura_m2?: number | null;
  estado: EstadoPedido;
  id_aprobador?: number | null;
  fecha_levantado?: string | null;
  fecha_resolucion?: string | null;
  saldo_anticipo?: SaldoAnticipo;
  aplicaciones?: AplicacionAnticipo[];
  aplicacion_anticipo?: AplicacionAnticipo | null;
};

export type PedidoDetalleItem = {
  id_detalle: number;
  descripcion: string;
  concepto_detalle?: string | null;
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

export type PedidoDetalleAnticipoItem = {
  id_detalle: number;
  concepto: string;
  unidad?: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
};

export type DetalleUnion =
  | PedidoDetalleItem
  | PedidoDetalleCristalItem
  | PedidoDetalleAluminioItem
  | PedidoDetalleAnticipoItem;

export type HistorialEstadoItem = {
  id: number;
  id_pedido: number;
  estado_anterior: EstadoPedido | null;
  estado_nuevo: EstadoPedido;
  comentario?: string | null;
  fecha_registro: string;
  nombre_usuario: string;
};
