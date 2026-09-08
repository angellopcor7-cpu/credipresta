import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { aplicarPagoDelDia, marcarIncumplidoDelDia } from "../actions";
import type { Cliente, Prestamo } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoClienteLabel: Record<string, string> = {
  pendiente_aprobacion: "Pendiente de aprobación",
  activo: "Al corriente",
  inactivo: "Inactivo",
};

/**
 * "Mis clientes": la pantalla principal del cobrador. Lista a todos sus
 * clientes con el total (con interés), lo abonado y el saldo de cada uno, y
 * arriba el total sumado de toda su cartera — tal cual lo pidió el negocio
 * ("que todos los clientes se suban y puedan ver el total").
 */
export default async function PanelCobradorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { error, exito } = await searchParams;
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const { data: clientesData } = await supabase
    .from("clientes")
    .select("*")
    .eq("cobrador_id", sesion.cobradorId)
    .order("created_at", { ascending: false });
  const clientes = (clientesData ?? []) as Cliente[];
  const clienteIds = clientes.map((c) => c.id);

  const { data: prestamosData } =
    clienteIds.length > 0
      ? await supabase.from("prestamos").select("*").in("cliente_id", clienteIds)
      : { data: [] as Prestamo[] };
  const prestamos = (prestamosData ?? []) as Prestamo[];

  const prestamoIds = prestamos.map((p) => p.id);
  const { data: morasData } =
    prestamoIds.length > 0
      ? await supabase.from("moras").select("prestamo_id").in("prestamo_id", prestamoIds).eq("estado", "pendiente")
      : { data: [] as { prestamo_id: string }[] };
  const prestamosConMora = new Set((morasData ?? []).map((m) => m.prestamo_id));

  const filas = clientes.map((cliente) => {
    const prestamosDelCliente = prestamos.filter((p) => p.cliente_id === cliente.id);
    const total = prestamosDelCliente.reduce((suma, p) => suma + Number(p.monto_total), 0);
    const saldo = prestamosDelCliente.reduce((suma, p) => suma + Number(p.saldo_actual), 0);
    const abonado = total - saldo;

    const prestamoActivo = prestamosDelCliente.find((p) => p.estado === "activo" || p.estado === "en_mora");
    const enMora = prestamosDelCliente.some((p) => prestamosConMora.has(p.id) || p.estado === "en_mora");
    const todosLiquidados = prestamosDelCliente.length > 0 && prestamosDelCliente.every((p) => p.estado === "liquidado");

    let estadoTexto = estadoClienteLabel[cliente.estado] ?? cliente.estado;
    if (cliente.estado === "activo") {
      estadoTexto = todosLiquidados ? "Liquidado" : enMora ? "En mora" : "Al corriente";
    }

    return { cliente, total, abonado, saldo, prestamoActivo, estadoTexto, enMora };
  });

  const totalCartera = filas.reduce((suma, f) => suma + f.total, 0);
  const abonadoCartera = filas.reduce((suma, f) => suma + f.abonado, 0);
  const saldoCartera = filas.reduce((suma, f) => suma + f.saldo, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mis clientes</h1>
        <Link
          href="/panel/clientes/nuevo"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo cliente
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-amber-400 bg-amber-950/50 border border-amber-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <ResumenCartera label="Total con interés" value={currency(totalCartera)} />
        <ResumenCartera label="Abonado" value={currency(abonadoCartera)} />
        <ResumenCartera label="Saldo pendiente" value={currency(saldoCartera)} destacado />
      </div>

      {clientes.length === 0 ? (
        <p className="text-slate-400 text-sm">
          Todavía no tienes clientes. Da de alta al primero con &quot;+ Nuevo cliente&quot;.
        </p>
      ) : (
        <div className="space-y-3">
          {filas.map(({ cliente, total, abonado, saldo, prestamoActivo, estadoTexto, enMora }) => (
            <div
              key={cliente.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-[10rem]">
                <Link href={`/panel/clientes/${cliente.id}`} className="font-medium hover:text-amber-400">
                  {cliente.nombre_completo}
                </Link>
                <p className="text-slate-500 text-xs">{cliente.telefono ?? "Sin teléfono"}</p>
                <span
                  className={`inline-block mt-1 text-xs border rounded-full px-2 py-0.5 ${
                    cliente.estado === "pendiente_aprobacion"
                      ? "bg-amber-950 text-amber-400 border-amber-900"
                      : enMora
                        ? "bg-red-950 text-red-400 border-red-900"
                        : "bg-sky-950 text-sky-400 border-sky-900"
                  }`}
                >
                  {estadoTexto}
                </span>
              </div>

              {prestamoActivo ? (
                <>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Total</p>
                      <p className="font-semibold">{currency(total)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Abonado</p>
                      <p className="font-semibold text-amber-400">{currency(abonado)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Saldo</p>
                      <p className="font-semibold">{currency(saldo)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <form action={aplicarPagoDelDia}>
                      <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                      <button className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-3 py-1.5 rounded-md">
                        Aplicar pago del día
                      </button>
                    </form>
                    <form action={marcarIncumplidoDelDia}>
                      <input type="hidden" name="prestamo_id" value={prestamoActivo.id} />
                      <button className="text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium px-3 py-1.5 rounded-md">
                        No pagó hoy
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  {cliente.estado === "pendiente_aprobacion"
                    ? "Esperando que Empresa apruebe la solicitud."
                    : "Sin préstamo activo."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResumenCartera({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-xl font-bold ${destacado ? "text-amber-400" : ""}`}>{value}</p>
    </div>
  );
}
