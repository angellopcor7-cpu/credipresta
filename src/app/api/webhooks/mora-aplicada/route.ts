import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushAUsuario } from "@/lib/push/enviar";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

/**
 * Webhook que llama la función de Supabase `aplicar_moras_automaticas()`
 * (vía pg_net, cada vez que le mete mora nueva a un préstamo) para avisarle
 * por push al cobrador EN EL MOMENTO — separado del aviso resumen de las
 * 10pm, a petición de Angel. Protegido con el mismo `CRON_SECRET` que usa
 * el cron de las 10pm (header `x-webhook-secret`, no Authorization, porque
 * así lo manda pg_net). A diferencia de los demás avisos, si el secreto no
 * está configurado se RECHAZA en vez de correr abierto — este endpoint
 * manda push con el contenido que le llegue en el cuerpo, así que sin
 * secreto cualquiera podría usarlo para mandar avisos falsos.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    prestamo_id?: string;
    cliente_id?: string;
    monto_mora?: number;
    mora_acumulada?: number;
  } | null;

  if (!body?.prestamo_id || !body?.cliente_id) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const [{ data: prestamo }, { data: cliente }] = await Promise.all([
    supabase.from("prestamos").select("cobrador_id").eq("id", body.prestamo_id).single(),
    supabase.from("clientes").select("nombre_completo").eq("id", body.cliente_id).single(),
  ]);

  if (!prestamo?.cobrador_id) {
    return NextResponse.json({ ok: true, avisado: false, motivo: "Préstamo sin cobrador" });
  }

  const { data: cobrador } = await supabase
    .from("cobradores")
    .select("usuario_id")
    .eq("id", prestamo.cobrador_id)
    .eq("activo", true)
    .maybeSingle();

  if (!cobrador) {
    return NextResponse.json({ ok: true, avisado: false, motivo: "Cobrador inactivo" });
  }

  await enviarPushAUsuario(cobrador.usuario_id, {
    title: "Mora acumulada",
    body: `${cliente?.nombre_completo ?? "Un cliente"}: se acumuló ${currency(Number(body.monto_mora ?? 0))} de mora (total ${currency(Number(body.mora_acumulada ?? 0))})`,
    url: `/panel/clientes/${body.cliente_id}`,
  });

  return NextResponse.json({ ok: true, avisado: true });
}
