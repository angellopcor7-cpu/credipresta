import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerConfiguraciones } from "@/lib/config";
import { esDiaDeCobro } from "@/lib/finance/calculos";
import { enviarPushAUsuario } from "@/lib/push/enviar";

/**
 * Corre una vez al día a las 10pm hora de Ciudad de México (ver vercel.json,
 * "0 4 * * *" en UTC — México ya no tiene horario de verano desde 2022, así
 * que siempre es UTC-6). Por cada cobrador, manda UN push resumiendo:
 * - Qué clientes de hoy (día de cobro para ellos) todavía no registran su
 *   pago del día.
 * - De esos y de cualquier otro con préstamo activo, cuáles ya tienen mora
 *   acumulada.
 * No manda nada si el cobrador no tiene ningún cliente en esas condiciones.
 *
 * Protegido con CRON_SECRET (Vercel lo manda solo como
 * "Authorization: Bearer <CRON_SECRET>" en sus crons configurados) — si la
 * variable no está puesta todavía, corre sin exigir nada (igual que las
 * llaves VAPID, para no bloquear el resto de la configuración inicial).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const config = await obtenerConfiguraciones();
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" }); // YYYY-MM-DD

  const { data: prestamos } = await supabase
    .from("prestamos")
    .select(
      "id, cobrador_id, monto_prestado, mora_acumulada, dias_cobro_personalizados, clientes(nombre_completo)"
    )
    .in("estado", ["activo", "en_mora"])
    .not("cobrador_id", "is", null);

  if (!prestamos || prestamos.length === 0) {
    return NextResponse.json({ ok: true, cobradoresAvisados: 0 });
  }

  const idsPrestamos = prestamos.map((p) => p.id);
  const { data: pagosHoyData } = await supabase
    .from("pagos")
    .select("prestamo_id")
    .eq("tipo", "cuota_diaria")
    .gte("fecha_pago", hoy)
    .in("prestamo_id", idsPrestamos);
  const prestamosConPagoHoy = new Set((pagosHoyData ?? []).map((p) => p.prestamo_id));

  type ClientePendiente = { nombre: string; noPagoHoy: boolean; conMora: boolean };
  const pendientesPorCobrador = new Map<string, ClientePendiente[]>();

  for (const p of prestamos) {
    const nombreCliente =
      (p.clientes as unknown as { nombre_completo?: string } | { nombre_completo?: string }[] | null) &&
      (Array.isArray(p.clientes) ? p.clientes[0]?.nombre_completo : (p.clientes as { nombre_completo?: string } | null)?.nombre_completo);

    const esDiaDeCobroHoy = esDiaDeCobro(
      new Date(`${hoy}T00:00:00Z`),
      Number(p.monto_prestado),
      config.reglaDiasCobro,
      p.dias_cobro_personalizados
    );
    const noPagoHoy = esDiaDeCobroHoy && !prestamosConPagoHoy.has(p.id);
    const conMora = Number(p.mora_acumulada) > 0;

    if (!noPagoHoy && !conMora) continue;
    if (!p.cobrador_id) continue;

    const lista = pendientesPorCobrador.get(p.cobrador_id) ?? [];
    lista.push({ nombre: nombreCliente || "Un cliente", noPagoHoy, conMora });
    pendientesPorCobrador.set(p.cobrador_id, lista);
  }

  if (pendientesPorCobrador.size === 0) {
    return NextResponse.json({ ok: true, cobradoresAvisados: 0 });
  }

  const { data: cobradoresData } = await supabase
    .from("cobradores")
    .select("id, usuario_id")
    .in("id", Array.from(pendientesPorCobrador.keys()))
    .eq("activo", true);

  let avisados = 0;
  await Promise.all(
    (cobradoresData ?? []).map(async (cobrador) => {
      const pendientes = pendientesPorCobrador.get(cobrador.id) ?? [];
      if (pendientes.length === 0) return;

      const sinPagar = pendientes.filter((c) => c.noPagoHoy);
      const conMora = pendientes.filter((c) => c.conMora);

      const partes: string[] = [];
      if (sinPagar.length > 0) {
        partes.push(`${sinPagar.length} no pagó hoy${sinPagar.length === 1 ? "" : "n"}`);
      }
      if (conMora.length > 0) {
        partes.push(`${conMora.length} con mora acumulada`);
      }

      const nombresUnicos = Array.from(new Set(pendientes.map((c) => c.nombre)));
      const nombresTexto =
        nombresUnicos.length <= 5
          ? nombresUnicos.join(", ")
          : `${nombresUnicos.slice(0, 5).join(", ")} y ${nombresUnicos.length - 5} más`;

      await enviarPushAUsuario(cobrador.usuario_id, {
        title: "Aviso de cobro — 10pm",
        body: `${partes.join(", ")}: ${nombresTexto}`,
        url: "/panel",
      });
      avisados += 1;
    })
  );

  return NextResponse.json({ ok: true, cobradoresAvisados: avisados });
}
