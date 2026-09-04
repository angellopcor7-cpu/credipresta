import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { exigirCliente } from "@/lib/auth/roles";
import { calcularInteres, calcularMontoTotal, calcularCuotaSugerida } from "@/lib/finance/calculos";
import { FirmaCanvas } from "./FirmaCanvas";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default async function FirmarPagarePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirCliente();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre_completo")
    .eq("usuario_id", sesion.id)
    .maybeSingle();

  if (!cliente) redirect("/cliente");

  const { data: solicitud } = await supabase
    .from("solicitudes_prestamo")
    .select("id, monto_solicitado, plazo_dias, estado, porcentaje_interes_diario_propuesto")
    .eq("id", id)
    .eq("cliente_id", cliente.id)
    .maybeSingle();

  if (!solicitud) redirect("/cliente");

  if (solicitud.estado === "firmada" || solicitud.estado === "aprobada") {
    redirect("/cliente?exito=" + encodeURIComponent("Ya firmaste esta solicitud."));
  }
  if (solicitud.estado !== "esperando_firma" || !solicitud.porcentaje_interes_diario_propuesto) {
    redirect("/cliente");
  }

  const montoSolicitado = Number(solicitud.monto_solicitado);
  const plazoDias = solicitud.plazo_dias;
  const porcentajeTotal = Number(solicitud.porcentaje_interes_diario_propuesto) * plazoDias;
  const interes = calcularInteres(montoSolicitado, porcentajeTotal);
  const total = calcularMontoTotal(montoSolicitado, porcentajeTotal);
  const pagoDiario = calcularCuotaSugerida(total, plazoDias);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Firmar tu pagaré</h1>
        <p className="text-slate-400 text-sm mt-1">
          Revisa los datos de tu préstamo y dibuja tu firma para confirmar que estás de acuerdo.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 text-sm">
        <p>
          Yo, <span className="font-semibold">{cliente.nombre_completo}</span>, declaro haber recibido de
          CrediPresta un préstamo por la cantidad de{" "}
          <span className="font-semibold">{currency(montoSolicitado)}</span>, y me obligo a pagar la cantidad
          total de <span className="font-semibold text-emerald-400">{currency(total)}</span> (incluye un interés
          del {porcentajeTotal}%), en un plazo de {plazoDias} días mediante abonos diarios sugeridos de{" "}
          <span className="font-semibold">{currency(pagoDiario)}</span>.
        </p>
        <div className="grid grid-cols-3 gap-3 bg-slate-950 border border-slate-800 rounded-lg p-3">
          <div>
            <p className="text-slate-500 text-xs">Interés total</p>
            <p className="font-semibold">
              {porcentajeTotal}% ({currency(interes)})
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Total a pagar</p>
            <p className="font-semibold text-emerald-400">{currency(total)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">Pago diario</p>
            <p className="font-semibold">{currency(pagoDiario)}</p>
          </div>
        </div>
      </div>

      <FirmaCanvas solicitudId={solicitud.id} />
    </div>
  );
}
