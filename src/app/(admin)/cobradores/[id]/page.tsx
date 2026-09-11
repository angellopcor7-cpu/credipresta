import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ChevronLeft,
  UserRound,
  Landmark,
  Wallet,
  CircleAlert,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { EditarCobradorForm } from "./EditarCobradorForm";
import { RestablecerPasswordForm } from "./RestablecerPasswordForm";
import { EstadoCobradorButton } from "./EstadoCobradorButton";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

function formatoFecha(fecha: string | null) {
  if (!fecha) return null;
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

const ESTADO_CLIENTE_LABEL: Record<string, string> = {
  activo: "Activo",
  pendiente_aprobacion: "Pendiente de aprobación",
  inactivo: "Rechazado",
};

export default async function DetalleCobradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; exito?: string }>;
}) {
  const { id } = await params;
  const { error, exito } = await searchParams;
  const supabase = await createClient();

  const { data: cobrador } = await supabase
    .from("cobradores")
    .select("id, usuario_id, zona, fecha_ingreso, activo, usuarios(nombre_completo, telefono)")
    .eq("id", id)
    .maybeSingle();

  if (!cobrador) notFound();

  const cobradorTyped = cobrador as unknown as {
    id: string;
    usuario_id: string;
    zona: string | null;
    fecha_ingreso: string | null;
    activo: boolean;
    usuarios: { nombre_completo: string; telefono: string | null } | null;
  };

  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(cobradorTyped.usuario_id);
    email = data.user?.email ?? null;
  } catch {
    email = null;
  }

  const [{ data: clientes }, { data: rutas }, { data: prestamos }, { data: moras }] = await Promise.all([
    supabase.from("clientes").select("id, nombre_completo, estado").eq("cobrador_id", id).order("nombre_completo"),
    supabase.from("rutas").select("id, nombre, zona, activa").eq("cobrador_id", id).order("nombre"),
    supabase.from("prestamos").select("estado, saldo_actual").eq("cobrador_id", id),
    supabase
      .from("moras")
      .select("monto_mora, prestamos!inner(cobrador_id)")
      .eq("estado", "pendiente")
      .eq("prestamos.cobrador_id", id),
  ]);

  const listaClientes = clientes ?? [];
  const listaPrestamos = prestamos ?? [];
  const clientesActivos = listaClientes.filter((c) => c.estado === "activo").length;
  const prestamosActivos = listaPrestamos.filter((p) => p.estado === "activo" || p.estado === "en_mora");
  const carteraActiva = prestamosActivos.reduce((s, p) => s + Number(p.saldo_actual), 0);
  const moraPendiente = (moras ?? []).reduce((s, m) => s + Number(m.monto_mora), 0);

  const stats: { label: string; value: string; icon: typeof UserRound }[] = [
    { label: "Clientes activos", value: String(clientesActivos), icon: UserRound },
    { label: "Préstamos activos", value: String(prestamosActivos.length), icon: Landmark },
    { label: "Cartera activa", value: currency(carteraActiva), icon: Wallet },
    { label: "Mora pendiente", value: currency(moraPendiente), icon: CircleAlert },
  ];

  const nombreCobrador = cobradorTyped.usuarios?.nombre_completo ?? "—";

  return (
    <div className="space-y-6">
      <Link href="/cobradores" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ChevronLeft className="h-4 w-4" />
        Cobradores
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{nombreCobrador}</h1>
            <span
              className={`text-xs border rounded-full px-2 py-1 ${
                cobradorTyped.activo
                  ? "bg-sky-950 text-sky-400 border-sky-900"
                  : "bg-slate-800 text-slate-500 border-slate-700"
              }`}
            >
              {cobradorTyped.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
            {cobradorTyped.usuarios?.telefono && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {cobradorTyped.usuarios.telefono}
              </span>
            )}
            {email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </span>
            )}
            {cobradorTyped.zona && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {cobradorTyped.zona}
              </span>
            )}
            {cobradorTyped.fecha_ingreso && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Desde {formatoFecha(cobradorTyped.fecha_ingreso)}
              </span>
            )}
          </div>
        </div>
        <EstadoCobradorButton
          cobradorId={cobradorTyped.id}
          usuarioId={cobradorTyped.usuario_id}
          nombreCobrador={nombreCobrador}
          activo={cobradorTyped.activo}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-emerald-400 bg-emerald-950/50 border border-emerald-900 rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-slate-400">
              <s.icon className="h-3.5 w-3.5" />
              <p className="text-xs">{s.label}</p>
            </div>
            <p className="text-xl font-semibold mt-2">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        <EditarCobradorForm
          cobradorId={cobradorTyped.id}
          usuarioId={cobradorTyped.usuario_id}
          nombreCompleto={nombreCobrador}
          telefono={cobradorTyped.usuarios?.telefono ?? null}
          zona={cobradorTyped.zona}
        />
        <RestablecerPasswordForm cobradorId={cobradorTyped.id} usuarioId={cobradorTyped.usuario_id} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Rutas asignadas</h2>
        {rutas && rutas.length > 0 ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Zona</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{r.nombre}</td>
                    <td className="px-4 py-3 text-slate-300">{r.zona ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{r.activa ? "Activa" : "Inactiva"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">
            Sin rutas asignadas todavía.{" "}
            <Link href="/rutas/nueva" className="text-amber-400 hover:underline">
              Crear una
            </Link>
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Clientes asignados ({listaClientes.length})</h2>
        {listaClientes.length > 0 ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {listaClientes.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{c.nombre_completo}</td>
                    <td className="px-4 py-3 text-slate-300">{ESTADO_CLIENTE_LABEL[c.estado] ?? c.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Este cobrador aún no tiene clientes asignados.</p>
        )}
      </div>
    </div>
  );
}
