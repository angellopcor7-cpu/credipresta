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
 * Determina si una fecha es día de cobro para un préstamo, según su monto.
 * Préstamos >= umbral (5,000): cobro lunes-viernes.
 * Préstamos < umbral: cobro lunes-sábado.
 */
export function esDiaDeCobro(fecha: Date, montoPrestamo: number, regla: ReglaDiasCobro): boolean {
  const diaSemana = fecha.getUTCDay(); // 0=domingo..6=sábado
  const diasPermitidos =
    montoPrestamo >= regla.umbral ? regla.diasMayorIgualUmbral : regla.diasMenorUmbral;
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
}): DiaCalendario[] {
  const { fechaInicio, plazoDias, montoPrestamo, montoCuota, regla } = params;
  const dias: DiaCalendario[] = [];
  const cursor = new Date(
    Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), fechaInicio.getUTCDate())
  );

  let numeroDia = 0;
  // Empieza a buscar días de cobro a partir del día siguiente al inicio.
  while (numeroDia < plazoDias) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (esDiaDeCobro(cursor, montoPrestamo, regla)) {
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

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}
