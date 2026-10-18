import type { createClient } from "@/lib/supabase/server";
import { estaEnSemana, domingoDe } from "@/lib/fechas";
import { formatoFechaCorta } from "@/lib/format";
import type { TipoComision, FilaCorteCobrador, TotalesCorte } from "@/lib/types";

export type { FilaCorteCobrador, TotalesCorte };

const ETIQUETA_ESTADO_CLIENTE: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente",
  inactivo: "Inactivo",
};

const ETIQUETA_ESTADO_PRESTAMO: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

export type ClienteRespaldo = {
  nombre: string;
  telefono: string | null;
  cobrador: string;
  estadoCliente: string;
  prestamoEstado: string | null;
  montoPrestado: number | null;
  saldoActual: number | null;
  moraAcumulada: number | null;
  faltaPorCobrar: number | null;
  fechaInicio: string | null;
};

/**
 * Inventario completo de TODOS los clientes (sin importar su estado, para
 * que el respaldo en PDF sirva de verdad como copia completa) con su
 * préstamo más reciente — no solo el activo, porque un cliente ya liquidado
 * también debe quedar en el respaldo con su último préstamo. Es una foto del
 * momento (no está limitada a la semana del corte, a diferencia de
 * `calcularCorte`): el respaldo es del estado actual de TODA la cartera.
 */
export async function construirDetalleClientes(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ClienteRespaldo[]> {
  const [{ data: clientesData }, { data: cobradoresData }, { data: prestamosData }] = await Promise.all([
    supabase.from("clientes").select("id, nombre_completo, telefono, estado, cobrador_id").order("nombre_completo"),
    supabase.from("cobradores").select("id, usuarios(nombre_completo)"),
    supabase
      .from("prestamos")
      .select("cliente_id, monto_prestado, saldo_actual, mora_acumulada, estado, fecha_inicio, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const clientes = (clientesData ?? []) as {
    id: string;
    nombre_completo: string;
    telefono: string | null;
    estado: string;
    cobrador_id: string | null;
  }[];
  const cobradores = (cobradoresData ?? []) as unknown as { id: string; usuarios: { nombre_completo: string } | null }[];
  const prestamos = (prestamosData ?? []) as {
    cliente_id: string;
    monto_prestado: number;
    saldo_actual: number;
    mora_acumulada: number;
    estado: string;
    fecha_inicio: string;
    created_at: string;
  }[];

  const nombreCobradorPorId = new Map(cobradores.map((c) => [c.id, c.usuarios?.nombre_completo ?? "—"]));
  // Ya vienen ordenados por created_at descendente, así que el primero que
  // se encuentre por cliente es su préstamo más reciente.
  const prestamoMasRecientePorCliente = new Map<string, (typeof prestamos)[number]>();
  for (const p of prestamos) {
    if (!prestamoMasRecientePorCliente.has(p.cliente_id)) prestamoMasRecientePorCliente.set(p.cliente_id, p);
  }

  return clientes.map((c) => {
    const prestamo = prestamoMasRecientePorCliente.get(c.id);
    return {
      nombre: c.nombre_completo,
      telefono: c.telefono,
      cobrador: c.cobrador_id ? (nombreCobradorPorId.get(c.cobrador_id) ?? "—") : "—",
      estadoCliente: ETIQUETA_ESTADO_CLIENTE[c.estado] ?? c.estado,
      prestamoEstado: prestamo ? (ETIQUETA_ESTADO_PRESTAMO[prestamo.estado] ?? prestamo.estado) : null,
      montoPrestado: prestamo ? Number(prestamo.monto_prestado) : null,
      saldoActual: prestamo ? Number(prestamo.saldo_actual) : null,
      moraAcumulada: prestamo ? Number(prestamo.mora_acumulada) : null,
      faltaPorCobrar: prestamo ? Number(prestamo.saldo_actual) + Number(prestamo.mora_acumulada) : null,
      fechaInicio: prestamo ? formatoFechaCorta(prestamo.fecha_inicio) : null,
    };
  });
}

/**
 * Arma el corte (prestado/recolectado/mora/comisión por cobrador, más
 * totales) de la semana `claveLunes`, calculado en vivo contra los datos
 * actuales. Lo usan tanto la pantalla /corte (para ver cualquier semana,
 * pasada o actual) como la acción `confirmarCorte` (para congelar estos
 * mismos números al cerrar la semana) — una sola fuente de verdad para que
 * nunca se desincronicen.
 */
export async function calcularCorte(
  supabase: Awaited<ReturnType<typeof createClient>>,
  claveLunes: string
): Promise<{ filas: FilaCorteCobrador[]; totales: TotalesCorte }> {
  const claveDomingo = domingoDe(claveLunes);

  const [
    { data: cobradoresData },
    { data: rutasData },
    { data: clientesData },
    { data: prestamosData },
    { data: pagosSemana },
    { data: morasSemana },
  ] = await Promise.all([
    supabase
      .from("cobradores")
      .select("id, zona, tipo_comision, porcentaje_comision, usuarios(nombre_completo)")
      .eq("activo", true),
    supabase.from("rutas").select("id, nombre, cobrador_id").eq("activa", true),
    supabase.from("clientes").select("id, cobrador_id").eq("estado", "activo"),
    supabase
      .from("prestamos")
      .select("id, cobrador_id, monto_prestado, created_at, saldo_actual, mora_acumulada, estado"),
    supabase
      .from("pagos")
      .select("cobrador_id, monto, fecha_pago")
      .gte("fecha_pago", claveLunes)
      .lte("fecha_pago", claveDomingo),
    supabase
      .from("moras")
      .select("monto_mora, fecha_generada, prestamo_id")
      .gte("fecha_generada", claveLunes)
      .lte("fecha_generada", claveDomingo),
  ]);

  const cobradores = (cobradoresData ?? []) as unknown as {
    id: string;
    zona: string | null;
    tipo_comision: TipoComision;
    porcentaje_comision: number;
    usuarios: { nombre_completo: string } | null;
  }[];
  const rutas = (rutasData ?? []) as { id: string; nombre: string; cobrador_id: string | null }[];
  const clientes = (clientesData ?? []) as { id: string; cobrador_id: string | null }[];
  const prestamos = (prestamosData ?? []) as {
    id: string;
    cobrador_id: string | null;
    monto_prestado: number;
    created_at: string;
    saldo_actual: number;
    mora_acumulada: number;
    estado: string;
  }[];
  const pagos = (pagosSemana ?? []) as { cobrador_id: string | null; monto: number; fecha_pago: string }[];
  const moras = (morasSemana ?? []) as { monto_mora: number; fecha_generada: string; prestamo_id: string }[];

  // Mapa préstamo -> cobrador, para poder sumar la mora de la semana (la
  // tabla `moras` no guarda cobrador_id directo) por cobrador.
  const cobradorPorPrestamo = new Map(prestamos.map((p) => [p.id, p.cobrador_id]));

  const filas: FilaCorteCobrador[] = cobradores
    .map((c) => {
      const nombre = c.usuarios?.nombre_completo ?? "—";
      const rutasDelCobrador = rutas.filter((r) => r.cobrador_id === c.id).map((r) => r.nombre);
      const clientesActivos = clientes.filter((cl) => cl.cobrador_id === c.id).length;

      const prestamosDelCobrador = prestamos.filter((p) => p.cobrador_id === c.id);
      const prestamosActivosDelCobrador = prestamosDelCobrador.filter(
        (p) => p.estado === "activo" || p.estado === "en_mora"
      );

      const prestadoSemana = prestamosDelCobrador
        .filter((p) => estaEnSemana(p.created_at, claveLunes))
        .reduce((s, p) => s + Number(p.monto_prestado), 0);

      const cobradoSemana = pagos.filter((p) => p.cobrador_id === c.id).reduce((s, p) => s + Number(p.monto), 0);

      const moraGeneradaSemana = moras
        .filter((m) => cobradorPorPrestamo.get(m.prestamo_id) === c.id)
        .reduce((s, m) => s + Number(m.monto_mora), 0);

      const saldoPendiente = prestamosActivosDelCobrador.reduce((s, p) => s + Number(p.saldo_actual), 0);
      const moraAcumulada = prestamosActivosDelCobrador.reduce((s, p) => s + Number(p.mora_acumulada), 0);
      const faltaPorCobrar = saldoPendiente + moraAcumulada;

      const comision =
        c.tipo_comision === "prestado"
          ? prestadoSemana * (c.porcentaje_comision / 100)
          : cobradoSemana * (c.porcentaje_comision / 100);

      return {
        id: c.id,
        nombre,
        zona: c.zona,
        rutas: rutasDelCobrador,
        clientesActivos,
        prestadoSemana,
        cobradoSemana,
        moraGeneradaSemana,
        saldoPendiente,
        moraAcumulada,
        faltaPorCobrar,
        tipoComision: c.tipo_comision,
        porcentajeComision: c.porcentaje_comision,
        comision,
      };
    })
    .sort((a, b) => b.faltaPorCobrar - a.faltaPorCobrar);

  const totales = filas.reduce<TotalesCorte>(
    (acc, f) => ({
      clientesActivos: acc.clientesActivos + f.clientesActivos,
      prestadoSemana: acc.prestadoSemana + f.prestadoSemana,
      cobradoSemana: acc.cobradoSemana + f.cobradoSemana,
      moraGeneradaSemana: acc.moraGeneradaSemana + f.moraGeneradaSemana,
      saldoPendiente: acc.saldoPendiente + f.saldoPendiente,
      moraAcumulada: acc.moraAcumulada + f.moraAcumulada,
      faltaPorCobrar: acc.faltaPorCobrar + f.faltaPorCobrar,
      comision: acc.comision + f.comision,
    }),
    {
      clientesActivos: 0,
      prestadoSemana: 0,
      cobradoSemana: 0,
      moraGeneradaSemana: 0,
      saldoPendiente: 0,
      moraAcumulada: 0,
      faltaPorCobrar: 0,
      comision: 0,
    }
  );

  return { filas, totales };
}
