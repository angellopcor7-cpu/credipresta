/**
 * Lógica financiera de CrediPresta $$.
 *
 * Funciones puras — sin efectos secundarios, sin llamadas a la base de datos.
 * Todo lo que involucra dinero real vive aquí para poder probarse de forma
 * aislada (ver tests/finance/).
 */

export type ReglaMora = {
  umbral: number;
  moraBaja: number;
  moraAlta: number;
};

export type ReglaDiasCobro = {
  /** Días de la semana (0=domingo..6=sábado) en que SÍ se cobra */
  diasMenorUmbral: number[];
  diasMayorIgualUmbral: number[];
  umbral: number;
};

/** interés = monto_prestado × (porcentaje / 100) */
export function calcularInteres(montoPrestado: number, porcentajeInteres: number): number {
  return redondear(montoPrestado * (porcentajeInteres / 100));
}

/** total_a_pagar = monto_prestado + interés */
export function calcularMontoTotal(montoPrestado: number, porcentajeInteres: number): number {
  return redondear(montoPrestado + calcularInteres(montoPrestado, porcentajeInteres));
}

/**
 * El interés total del préstamo = interés diario × plazo en días. El
 * administrador decide el interés diario al crear el préstamo (por defecto
 * 1%), y el plazo puede ser cualquier número de días — no está limitado a
 * 20 o 30. Ej.: 1% diario a 20 días = 20% total; 1% diario a 45 días = 45%.
 */
export function calcularPorcentajeInteresTotal(porcentajeInteresDiario: number, plazoDias: number): number {
  if (porcentajeInteresDiario <= 0) throw new Error("El interés diario debe ser mayor a 0");
  if (plazoDias <= 0) throw new Error("El plazo en días debe ser mayor a 0");
  return redondear(porcentajeInteresDiario * plazoDias);
}

export type PlanPrestamo = 20 | 30;

/** Planes fijos del negocio: a 20 días el interés total es 20%, a 30 días es 32%. */
const INTERES_TOTAL_POR_PLAN: Record<PlanPrestamo, number> = {
  20: 20,
  30: 32,
};

/** El único dato que se elige es 20 o 30 días — el interés total ya viene fijo por el plan. */
export function calcularPorcentajeInteresPorPlan(plazoDias: PlanPrestamo): number {
  return INTERES_TOTAL_POR_PLAN[plazoDias];
}

export function esPlanValido(plazoDias: number): plazoDias is PlanPrestamo {
  return plazoDias === 20 || plazoDias === 30;
}

/** cuota sugerida = total / plazo_dias (referencia, no es una obligación rígida por día) */
export function calcularCuotaSugerida(montoTotal: number, plazoDias: number): number {
  if (plazoDias <= 0) throw new Error("plazoDias debe ser mayor a 0");
  return redondear(montoTotal / plazoDias);
}

/**
 * saldo_actual = monto_total − suma de todos los pagos (abonos y cuotas por
 * igual). El saldo NUNCA debe quedar negativo — un pago que exceda el saldo
 * pendiente se recorta al saldo restante antes de guardarse (ver
 * validarMontoPago).
 */
export function calcularSaldo(montoTotal: number, pagos: number[]): number {
  const totalPagado = pagos.reduce((suma, monto) => suma + monto, 0);
  return Math.max(0, redondear(montoTotal - totalPagado));
}

/** Evita que un pago deje el préstamo con saldo negativo. */
export function validarMontoPago(montoPago: number, saldoActual: number): { valido: boolean; motivo?: string } {
  if (montoPago <= 0) return { valido: false, motivo: "El monto debe ser mayor a 0" };
  if (montoPago > saldoActual) {
    return {
      valido: false,
      motivo: `El pago ($${montoPago}) es mayor al saldo pendiente ($${saldoActual})`,
    };
  }
  return { valido: true };
}

/**
 * Monto de mora según el saldo actual del préstamo.
 * < umbral (5,000) → moraBaja (50)
 * >= umbral → moraAlta (100)
 */
export function calcularMontoMora(saldoActual: number, regla: ReglaMora): number {
  return saldoActual >= regla.umbral ? regla.moraAlta : regla.moraBaja;
}

/** Suma la mora del día al saldo del préstamo (nunca resta, la mora siempre incrementa la deuda). */
export function calcularSaldoConMora(saldoActual: number, montoMora: number): number {
  return redondear(saldoActual + montoMora);
}

/**
 * Reparte un pago entre la mora acumulada y el saldo de principal+interés:
 * primero abona a la mora (hasta dejarla en cero), y lo que sobra va al
 * saldo. Así un cliente siempre "limpia" su mora antes que el préstamo en
 * sí — es la misma regla que se usó para separar los dos montos en los
 * préstamos que ya existían (ver migración de mora_acumulada).
 */
export function calcularAsignacionPago(
  saldoActual: number,
  moraAcumulada: number,
  montoPago: number
): { saldoNuevo: number; moraNueva: number } {
  const aMora = Math.min(montoPago, moraAcumulada);
  const aSaldo = Math.min(redondear(montoPago - aMora), saldoActual);
  return {
    saldoNuevo: Math.max(0, redondear(saldoActual - aSaldo)),
    moraNueva: Math.max(0, redondear(moraAcumulada - aMora)),
  };
}

/**
 * Aplica varios días de cuota diaria seguidos (para cuando Empresa aprueba
 * una solicitud de "pagó varios días"). Reparte cada día con la misma regla
 * de `calcularAsignacionPago` (primero mora, luego saldo) y se detiene antes
 * de usar todos los días pedidos si el préstamo ya quedó en $0 — así nunca
 * se registra un día de $0. Devuelve el monto de cada día por separado para
 * poder insertar un renglón de `pagos` por día, igual que si el cliente
 * hubiera pagado uno por uno.
 */
export function aplicarPagoVariosDias(
  saldoActual: number,
  moraAcumulada: number,
  montoCuota: number,
  dias: number
): { montosPorDia: number[]; saldoFinal: number; moraFinal: number } {
  let saldo = saldoActual;
  let mora = moraAcumulada;
  const montosPorDia: number[] = [];
  for (let i = 0; i < dias; i++) {
    const restante = redondear(saldo + mora);
    if (restante <= 0) break;
    const montoDia = Math.min(montoCuota, restante);
    const { saldoNuevo, moraNueva } = calcularAsignacionPago(saldo, mora, montoDia);
    montosPorDia.push(montoDia);
    saldo = saldoNuevo;
    mora = moraNueva;
  }
  return { montosPorDia, saldoFinal: saldo, moraFinal: mora };
}

export type EstadoCuota = "pendiente" | "pagado" | "parcial" | "no_aplica";

export type CuotaCalendario = {
  fechaProgramada: string; // YYYY-MM-DD
  estado: EstadoCuota;
};

/**
 * Un préstamo está en atraso si tiene al menos un día de cobro programado
 * ANTES de `hoy` que sigue sin pagarse por completo (pendiente o parcial).
 * Es la condición que determina si hoy le toca generar mora.
 */
export function tieneCuotaVencidaSinPagar(calendario: CuotaCalendario[], hoy: string): boolean {
  return calendario.some(
    (dia) => dia.fechaProgramada < hoy && (dia.estado === "pendiente" || dia.estado === "parcial")
  );
}

/**
 * Para pintar el calendario de cobro como calendario (no como tabla): el
 * sistema no guarda a qué día del calendario corresponde cada pago (los
 * pagos solo tienen un monto y una fecha en que se registraron, no un
 * "número de día" — y un pago de un préstamo nuevo cubre el día 1, el 2, el
 * 3... en orden, sin importar qué fecha real haya sido). Entonces: se
 * cuentan cuántos pagos de cuota diaria se han registrado en total y se
 * marcan como "pagados" esos mismos N días del calendario, en orden
 * (numero_dia 1, 2, 3...) — así el calendario avanza correcto incluso si un
 * día se pagaron dos o tres cuotas de un jalón (pago de varios días).
 */
export function obtenerFechasPagadas(
  calendario: { numeroDia: number; fechaProgramada: string }[],
  cantidadPagos: number
): Set<string> {
  const ordenado = [...calendario].sort((a, b) => a.numeroDia - b.numeroDia);
  return new Set(ordenado.slice(0, cantidadPagos).map((d) => d.fechaProgramada));
}

/**
 * Semáforo de un cliente para la vista de Empresa — qué tan al día va con
 * sus pagos, de un vistazo:
 * - "rojo": tiene mora (acumulada o por una cuota vencida sin pagar), o su
 *   préstamo ya está marcado "en_mora".
 * - "amarillo": no tiene nada atrasado, pero hoy SÍ le toca pagar y todavía
 *   no se ha registrado su pago de hoy.
 * - "verde": todo en orden — ya pagó hoy, o hoy no era día de cobro para él.
 * - "sin_prestamo": no tiene un préstamo activo en este momento (está
 *   pendiente de aprobación, liquidado sin renovar, o inactivo) — el
 *   semáforo no aplica.
 */
export type SemaforoCliente = "verde" | "amarillo" | "rojo" | "sin_prestamo";

export function calcularSemaforoCliente(params: {
  tienePrestamoActivo: boolean;
  enMora: boolean;
  moraAcumulada: number;
  tieneCuotaVencida: boolean;
  esDiaDeCobroHoy: boolean;
  yaPagoHoy: boolean;
}): SemaforoCliente {
  if (!params.tienePrestamoActivo) return "sin_prestamo";
  if (params.enMora || params.moraAcumulada > 0 || params.tieneCuotaVencida) return "rojo";
  if (params.esDiaDeCobroHoy && !params.yaPagoHoy) return "amarillo";
  return "verde";
}

/**
 * Determina si una fecha es día de cobro para un préstamo, según su monto —
 * a menos que ese préstamo tenga días personalizados (`diasPersonalizados`,
 * elegidos por el cobrador al crearlo), en cuyo caso esos mandan sobre la
 * regla general. Esto es lo que le permite a un cobrador dejar que un
 * cliente puntual pague fines de semana aunque el préstamo sea >= al umbral.
 * Préstamos >= umbral (5,000) sin días personalizados: cobro lunes-viernes.
 * Préstamos < umbral sin días personalizados: cobro lunes-sábado.
 */
export function esDiaDeCobro(
  fecha: Date,
  montoPrestamo: number,
  regla: ReglaDiasCobro,
  diasPersonalizados?: number[] | null
): boolean {
  const diaSemana = fecha.getUTCDay(); // 0=domingo..6=sábado
  const diasPermitidos =
    diasPersonalizados ?? (montoPrestamo >= regla.umbral ? regla.diasMayorIgualUmbral : regla.diasMenorUmbral);
  return diasPermitidos.includes(diaSemana);
}

export type DiaCalendario = {
  numeroDia: number;
  fechaProgramada: string; // YYYY-MM-DD
  montoEsperado: number;
};

/**
 * Genera el calendario de cobro de un préstamo: `plazoDias` fechas de cobro,
 * empezando el día después de `fechaInicio`, saltando los días que no
 * correspondan según el monto del préstamo (fines de semana según la regla).
 */
export function generarCalendarioPagos(params: {
  fechaInicio: Date;
  plazoDias: number;
  montoPrestamo: number;
  montoCuota: number;
  regla: ReglaDiasCobro;
  diasPersonalizados?: number[] | null;
}): DiaCalendario[] {
  const { fechaInicio, plazoDias, montoPrestamo, montoCuota, regla, diasPersonalizados } = params;
  const dias: DiaCalendario[] = [];
  const cursor = new Date(
    Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate())
  );

  let numeroDia = 0;
  // Empieza a buscar días de cobro a partir del día siguiente al inicio.
  while (numeroDia < plazoDias) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (esDiaDeCobro(cursor, montoPrestamo, regla, diasPersonalizados)) {
      numeroDia += 1;
      dias.push({
        numeroDia,
        fechaProgramada: cursor.toISOString().slice(0, 10),
        montoEsperado: montoCuota,
      });
    }
  }

  return dias;
}

export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Descuento fijo de "apertura" que Empresa le hace al cliente sobre el TOTAL
 * a pagar (no se le resta de lo que recibe, ni se le suma a su deuda — se
 * resta directo del monto_total ya calculado con interés) cada vez que se
 * abre un préstamo:
 * - Cliente nuevo (nunca tuvo otro préstamo con el negocio): $50.
 * - Renovación en un día distinto al que liquidó su préstamo anterior (o
 *   habiendo completado su plazo normal): $50.
 * - Renovación el MISMO día en que liquidó Y liquidó antes de completar su
 *   plazo (pagó de más rápido de lo que le tocaba y de inmediato pidió otro
 *   préstamo): $150 en total — así lo definió Angel.
 */
export const DESCUENTO_APERTURA_NORMAL = 50;
export const DESCUENTO_APERTURA_RENOVACION_EXPRES = 150;

export type MotivoDescuentoApertura =
  | "cliente_nuevo"
  | "renovacion_normal"
  | "renovacion_mismo_dia_liquidacion_anticipada";

export function calcularDescuentoApertura(params: {
  esClienteNuevo: boolean;
  liquidoAntesDeTiempo: boolean;
  renovacionMismoDiaQueLiquidacion: boolean;
}): { descuento: number; motivo: MotivoDescuentoApertura } {
  if (params.esClienteNuevo) {
    return { descuento: DESCUENTO_APERTURA_NORMAL, motivo: "cliente_nuevo" };
  }
  if (params.liquidoAntesDeTiempo && params.renovacionMismoDiaQueLiquidacion) {
    return { descuento: DESCUENTO_APERTURA_RENOVACION_EXPRES, motivo: "renovacion_mismo_dia_liquidacion_anticipada" };
  }
  return { descuento: DESCUENTO_APERTURA_NORMAL, motivo: "renovacion_normal" };
}

/** monto_total ya con el descuento de apertura aplicado, nunca negativo. */
export function aplicarDescuentoApertura(montoTotal: number, descuento: number): number {
  return Math.max(0, redondear(montoTotal - descuento));
}
