import type { createClient } from "@/lib/supabase/server";
import { estaEnSemana, domingoDe } from "@/lib/fechas";
import type { TipoComision, FilaCorteCobrador, TotalesCorte } from "@/lib/types";

export type { FilaCorteCobrador, TotalesCorte };

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
