import { createClient } from "@/lib/supabase/server";
import { exigirCobrador } from "@/lib/auth/roles";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

const estadoLabel: Record<string, string> = {
  activo: "Activo",
  en_mora: "En mora",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
};

/**
 * Vista básica de cobrador: sus clientes asignados y sus préstamos en
 * cartera. Todavía es solo lectura — registrar pagos desde aquí es un paso
 * aparte (registrarPago hoy exige rol administrador).
 */
export default async function PanelCobradorPage() {
  const sesion = await exigirCobrador();
  const supabase = await createClient();

  if (!sesion.cobradorId) {
    return (
      <p className="text-slate-400 text-sm">
        Tu cuenta tiene rol de cobrador pero no está vinculada a un registro de cobrador. Pide a un administrador
        que la revise.
      </p>
    );
  }

  const [{ data: cobrador }, { data: asignaciones }, { data: prestamos }] = await Promise.all([
    supabase.from("cobradores").select("zona, activo").eq("id", sesion.cobradorId).single(),
    supabase
      .from("asignaciones")
      .select("cliente_id, ruta_id, clientes(nombre_completo, telefono), rutas(nombre)")
      .eq("cobrador_id", sesion.cobradorId)
      .is("fecha_fin", null),
    // Sin filtro por cobrador_id: la política RLS de `prestamos` ya limita
    // esto a los préstamos de los clientes asignados a este cobrador (vía
    // `cliente_asignado_a_mi()`), que es la fuente de verdad real — no la
    // columna prestamos.cobrador_id, que puede no coincidir.
    supabase
      .from("prestamos")
      .select("id, saldo_actual, estado, monto_total, clientes(nombre_completo)")
      .order("created_at", { ascending: false }),
  ]);

  const listaAsignaciones = asignaciones ?? [];
  const listaPrestamos = prestamos ?? [];
  const carteraActiva = listaPrestamos
    .filter((p) => p.estado === "activo" || p.estado === "en_mora")
    .reduce((s, p) => s + Number(p.saldo_actual), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mi panel de cobro</h1>
        <p className="text-slate-400 text-sm">Zona: {cobrador?.zona ?? "Sin zona asignada"}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Clientes asignados</p>
          <p className="text-xl font-semibold mt-1">{listaAsignaciones.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Préstamos en cartera</p>
          <p className="text-xl font-semibold mt-1">{listaPrestamos.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs">Cartera activa pendiente</p>
          <p className="text-xl font-semibold mt-1 text-emerald-400">{currency(carteraActiva)}</p>
        </div>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Mis préstamos</h2>
        {listaPrestamos.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes préstamos asignados todavía.</p>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Saldo actual</th>
                </tr>
              </thead>
              <tbody>
                {listaPrestamos.map((p) => {
                  const cliente = p.clientes as unknown as { nombre_completo: string } | null;
                  return (
                    <tr key={p.id} className="border-t border-slate-800">
                      <td className="px-3 py-2">{cliente?.nombre_completo ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{estadoLabel[p.estado] ?? p.estado}</td>
                      <td className="px-3 py-2 text-emerald-400">{currency(Number(p.saldo_actual))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">Mis clientes</h2>
        {listaAsignaciones.length === 0 ? (
          <p className="text-slate-500 text-sm">No tienes clientes asignados todavía.</p>
        ) : (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Ruta</th>
                </tr>
              </thead>
              <tbody>
                {listaAsignaciones.map((a, i) => {
                  const cliente = a.clientes as unknown as { nombre_completo: string; telefono: string | null } | null;
                  const ruta = a.rutas as unknown as { nombre: string } | null;
                  return (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="px-3 py-2">{cliente?.nombre_completo ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{cliente?.telefono ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-300">{ruta?.nombre ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
