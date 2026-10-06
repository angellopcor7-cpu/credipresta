export type EstadoCliente = "activo" | "pendiente_aprobacion" | "inactivo";

export type Cliente = {
  id: string;
  usuario_id: string | null;
  cobrador_id: string | null;
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
  | "pagare_firmado"
  | "otro";

export type DocumentoCliente = {
  id: string;
  cliente_id: string;
  tipo_documento: TipoDocumento;
  storage_path: string;
  subido_por: string | null;
  created_at: string;
};

/** "prestado": gana % de lo que presta. "recolectado": gana % de lo que cobra/recolecta. */
export type TipoComision = "prestado" | "recolectado";

export const TIPOS_COMISION: { value: TipoComision; label: string }[] = [
  { value: "recolectado", label: "% de lo recolectado" },
  { value: "prestado", label: "% de lo prestado" },
];

export type Cobrador = {
  id: string;
  usuario_id: string;
  zona: string | null;
  fecha_ingreso: string | null;
  activo: boolean;
  tipo_comision: TipoComision;
  porcentaje_comision: number;
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

export type MetodoPago = "efectivo" | "transferencia" | "ambos";

export const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "ambos", label: "Ambos" },
];

export type Prestamo = {
  id: string;
  cliente_id: string;
  cobrador_id: string | null;
  monto_prestado: number;
  porcentaje_interes: number;
  monto_interes: number;
  monto_total: number;
  /** Saldo de PRINCIPAL + INTERÉS nada más. La mora se trackea aparte, ver mora_acumulada. */
  saldo_actual: number;
  /** Mora generada y todavía sin pagar/condonar — ya NO está mezclada con saldo_actual. */
  mora_acumulada: number;
  plazo_dias: number;
  monto_cuota_sugerida: number;
  fecha_inicio: string;
  estado: EstadoPrestamo;
  fecha_liquidacion: string | null;
  metodo_pago: MetodoPago;
  datos_transferencia: string | null;
  dias_cobro_personalizados: number[] | null;
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

/**
 * El cobrador da de alta al cliente y arma la solicitud con foto de INE y de
 * pagaré ya firmado a mano (el cliente no tiene cuenta ni firma nada dentro
 * de la app) -> pendiente -> Empresa aprueba/rechaza directamente.
 */
export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

export type SolicitudPrestamo = {
  id: string;
  cliente_id: string;
  monto_solicitado: number;
  plazo_dias: number;
  /** Si no es null, este % de interés TOTAL sustituye al fijo por plan (20%/32%). */
  porcentaje_interes_personalizado: number | null;
  estado: EstadoSolicitud;
  fecha_solicitud: string;
  metodo_pago: MetodoPago;
  datos_transferencia: string | null;
  dias_cobro_personalizados: number[] | null;
  revisado_por: string | null;
  fecha_revision: string | null;
  notas_revision: string | null;
  prestamo_id: string | null;
  created_at: string;
};

export type SolicitudConCliente = SolicitudPrestamo & {
  clientes: { nombre_completo: string; telefono: string | null; direccion: string | null } | null;
};

/** Una fila del corte semanal (desglose por cobrador) — ver src/app/(admin)/corte/calcular.ts. */
export type FilaCorteCobrador = {
  id: string;
  nombre: string;
  zona: string | null;
  rutas: string[];
  clientesActivos: number;
  prestadoSemana: number;
  cobradoSemana: number;
  moraGeneradaSemana: number;
  saldoPendiente: number;
  moraAcumulada: number;
  faltaPorCobrar: number;
  tipoComision: TipoComision;
  porcentajeComision: number;
  comision: number;
};

export type TotalesCorte = {
  clientesActivos: number;
  prestadoSemana: number;
  cobradoSemana: number;
  moraGeneradaSemana: number;
  saldoPendiente: number;
  moraAcumulada: number;
  faltaPorCobrar: number;
  comision: number;
};

/**
 * Solicitud que manda el cobrador pidiendo que Empresa le perdone (total o
 * parcialmente) la mora acumulada de un cliente. El cobrador NO decide
 * cuánto se perdona — solo pide, y Empresa resuelve cuánto (o rechaza). Solo
 * se puede pedir desde el 2º día de atraso en adelante (ver
 * `panel/clientes/[id]/page.tsx`).
 */
export type EstadoSolicitudMora = "pendiente" | "aprobada" | "rechazada";

export type SolicitudPerdonMora = {
  id: string;
  prestamo_id: string;
  cliente_id: string;
  cobrador_id: string | null;
  mora_al_momento: number;
  dias_atraso_al_momento: number | null;
  notas_cobrador: string | null;
  estado: EstadoSolicitudMora;
  monto_perdonado: number | null;
  notas_resolucion: string | null;
  solicitado_por: string | null;
  resuelto_por: string | null;
  created_at: string;
  fecha_resolucion: string | null;
};

export type SolicitudPerdonMoraConDetalle = SolicitudPerdonMora & {
  clientes: { nombre_completo: string; telefono: string | null } | null;
  cobradores: { usuarios: { nombre_completo: string } | null } | null;
};

/**
 * Registro permanente de un corte semanal ya confirmado (botón "Confirmar
 * corte" en /corte). `detalle` guarda el arreglo de FilaCorteCobrador tal
 * como estaba al momento de cerrar la semana — es la foto fija que no
 * cambia aunque después se editen pagos o moras de esa semana.
 */
export type CorteSemanal = {
  id: string;
  clave_lunes: string;
  clave_domingo: string;
  fecha_corte: string;
  creado_por: string | null;
  total_clientes_activos: number;
  total_prestado_semana: number;
  total_cobrado_semana: number;
  total_mora_generada_semana: number;
  total_mora_acumulada: number;
  total_falta_por_cobrar: number;
  total_comision: number;
  detalle: FilaCorteCobrador[];
};
