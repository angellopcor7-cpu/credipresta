import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { obtenerConfiguraciones } from "@/lib/config";
import { RenovarPrestamoForm } from "./RenovarPrestamoForm";

/**
 * "Solicitar nuevo préstamo" para un cliente que YA existe y ya tiene
 * historial (normalmente: liquidó el anterior). Solo tiene sentido si de
 * verdad no tiene un préstamo abierto ahorita y no hay ya otra solicitud
 * esperando respuesta — si alguna de esas ya no aplica, regresa a su ficha
 * en vez de mostrar el formulario.
 */
export default async function RenovarPrestamoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre_completo, estado")
    .eq("id", id)
    .eq("cobrador_id", sesion.cobradorId)
    .maybeSingle();

  if (!cliente) notFound();

  if (cliente.estado === "pendiente_aprobacion") {
    redirect(`/panel/clientes/${id}?error=${encodeURIComponent("Ya hay una solicitud esperando respuesta de Empresa")}`);
  }

  const { count: prestamoActivoCount } = await supabase
    .from("prestamos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id)
    .in("estado", ["activo", "en_mora"]);

  if (prestamoActivoCount) {
    redirect(`/panel/clientes/${id}?error=${encodeURIComponent("Este cliente ya tiene un préstamo activo")}`);
  }

  const config = await obtenerConfiguraciones();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href={`/panel/clientes/${id}`} className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          {cliente.nombre_completo}
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <div className="rounded-lg bg-amber-500/10 p-1.5">
            <Landmark className="h-5 w-5 text-accent-text" />
          </div>
          <h1 className="text-2xl font-bold">Nuevo préstamo para {cliente.nombre_completo}</h1>
        </div>
        <p className="text-ink-muted text-sm mt-1">
          Como ya es cliente, no hace falta volver a subir su INE ni sus documentos — nomás elige el plan, genera
          el pagaré y fírmenlo los dos. Esta solicitud queda pendiente hasta que Empresa la apruebe.
        </p>
      </div>

      <RenovarPrestamoForm
        clienteId={cliente.id}
        nombreCliente={cliente.nombre_completo}
        error={error}
        nombreCobrador={sesion.nombreCompleto}
        lugarPagare={config.lugarPagare}
        interesMoratorioDiarioPagare={config.interesMoratorioDiarioPagare}
      />
    </div>
  );
}
