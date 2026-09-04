export type EstadoCliente = "activo" | "pendiente_aprobacion" | "inactivo";

export type Cliente = {
  id: string;
  usuario_id: string | null;
  nombre_completo: string;
  telefono: string | null;
  direccion: string | null;
  identificacion: string | null;
  referencia_personal: string | null;
  notas: string | null;
  estado: EstadoCliente;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type TipoDocumento =
  | "ine_frente"
  | "ine_reverso"
  | "comprobante_domicilio"
  | "foto_cliente"
  | "contrato_pagare"
  | "otro";

export type DocumentoCliente = {
  id: string;
  cliente_id: string;
  tipo_documento: TipoDocumento;
  storage_path: string;
  subido_por: string | null;
  created_at: string;
};

export type Cobrador = {
  id: string;
  usuario_id: string;
  zona: string | null;
  fecha_ingreso: string | null;
  activo: boolean;
};

export type CobradorConUsuario = Cobrador & {
  usuarios: { nombre_completo: string; telefono: string | null } | null;
};

export type Ruta = {
  id: string;
  nombre: string;
  zona: string | null;
  cobrador_id: string | null;
  activa: boolean;
  created_at: string;
};

export type EstadoPrestamo = "activo" | "en_mora" | "liquidado" | "cancelado";

export type Prestamo = {
  id: string;
  cliente_id: string;
  cobrador_id: string | null;
  monto_prestado: number;
  porcentaje_interes: number;
  monto_interes: number;
  monto_total: number;
  saldo_actual: number;
  plazo_dias: number;
  monto_cuota_sugerida: number;
  fecha_inicio: string;
  estado: EstadoPrestamo;
  fecha_liquidacion: string | null;
  creado_por: string | null;
  created_at: string;
};

export type PrestamoConCliente = Prestamo & {
  clientes: { nombre_completo: string } | null;
};

export type EstadoDiaCalendario = "pendiente" | "pagado" | "parcial" | "no_aplica";

export type CalendarioPago = {
  id: string;
  prestamo_id: string;
  numero_dia: number;
  fecha_programada: string;
  monto_esperado: number;
  estado: EstadoDiaCalendario;
};

export type TipoPago = "cuota_diaria" | "abono_libre" | "pago_mora";

export type Pago = {
  id: string;
  prestamo_id: string;
  calendario_pago_id: string | null;
  cliente_id: string | null;
  cobrador_id: string | null;
  monto: number;
  tipo: TipoPago;
  fecha_pago: string;
  saldo_anterior: number | null;
  saldo_posterior: number | null;
  registrado_por: string | null;
  metodo: string | null;
  notas: string | null;
  created_at: string;
};

export type EstadoMora = "pendiente" | "pagada" | "condonada";

export type Mora = {
  id: string;
  prestamo_id: string;
  calendario_pago_id: string | null;
  monto_mora: number;
  dia_atraso: number;
  saldo_anterior: number;
  saldo_posterior: number;
  fecha_generada: string;
  estado: EstadoMora;
  fecha_pago: string | null;
  generada_por: string;
};

export type HistorialMovimiento = {
  id: string;
  prestamo_id: string | null;
  cliente_id: string | null;
  usuario_id: string | null;
  tipo_movimiento: string;
  descripcion: string | null;
  monto: number | null;
  created_at: string;
};

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

export type SolicitudPrestamo = {
  id: string;
  cliente_id: string;
  monto_solicitado: number;
  plazo_dias: number;
  estado: EstadoSolicitud;
  fecha_solicitud: string;
  revisado_por: string | null;
  fecha_revision: string | null;
  notas_revision: string | null;
  prestamo_id: string | null;
  created_at: string;
};

export type SolicitudConCliente = SolicitudPrestamo & {
  clientes: { nombre_completo: string; telefono: string | null } | null;
};
