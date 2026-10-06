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
  Route,
  CalendarDays,
} from "lucide-react";
import { EditarCobradorForm } from "./EditarCobradorForm";
import { RestablecerPasswordForm } from "./RestablecerPasswordForm";
import { AgregarRutaForm } from "./AgregarRutaForm";
import { EstadoCobradorButton } from "./EstadoCobradorButton";
import { ReasignarTodosForm } from "./ReasignarTodosForm";
import { reasignarCliente } from "../actions";
import { TIPOS_COMISION, type TipoComision } from "@/lib/types";

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
    .select(
      "id, usuario_id, zona, fecha_ingreso, activo, tipo_comision, porcentaje_comision, usuarios(nombre_completo, telefono)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!cobrador) notFound();

  const cobradorTyped = cobrador as unknown as {
    id: string;
    usuario_id: string;
    zona: string | null;
    fecha_ingreso: string | null;
    activo: boolean;
    tipo_comision: TipoComision;
    porcentaje_comision: number;
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

  const [{ data: clientes }, { data: rutas }, { data: prestamos }, { data: otrosCobradoresData }] = await Promise.all([
    supabase.from("clientes").select("id, nombre_completo, estado").eq("cobrador_id", id).order("nombre_completo"),
    supabase.from("rutas").select("id, nombre, activa").eq("cobrador_id", id).order("nombre"),
    supabase.from("prestamos").select("estado, saldo_actual, mora_acumulada, monto_prestado").eq("cobrador_id", id),
    supabase
      .from("cobradores")
      .select("id, usuarios(nombre_completo)")
      .eq("activo", true)
      .neq("id", id),
  ]);

  const otrosCobradores = (otrosCobradoresData ?? []).map((c) => {
    const co = c as unknown as { id: string; usuarios: { nombre_completo: string } | null };
    return { id: co.id, nombre: co.usuarios?.nombre_completo ?? "—" };
  });

  const listaClientes = clientes ?? [];
  const listaPrestamos = prestamos ?? [];
  const clientesActivos = listaClientes.filter((c) => c.estado === "activo").length;
  const prestamosActivos = listaPrestamos.filter((p) => p.estado === "activo" || p.estado === "en_mora");
  const carteraActiva = prestamosActivos.reduce((s, p) => s + Number(p.saldo_actual), 0);
  const moraPendiente = prestamosActivos.reduce((s, p) => s + Number(p.mora_acumulada), 0);
  const totalPrestadoHistorico = listaPrestamos.reduce((s, p) => s + Number(p.monto_prestado), 0);
  const comisionEstimada =
    cobradorTyped.tipo_comision === "prestado"
      ? totalPrestadoHistorico * (Number(cobradorTyped.porcentaje_comision) / 100)
      : null; // "recolectado" se calcula en el corte semanal (depende de lo cobrado en el periodo, no de un total acumulado).

  const stats: { label: string; value: string; icon: typeof UserRound }[] = [
    { label: "Clientes activos", value: String(clientesActivos), icon: UserRound },
    { label: "Préstamos activos", value: String(prestamosActivos.length), icon: Landmark },
    { label: "Cartera activa", value: currency(carteraActiva), icon: Wallet },
    { label: "Mora pendiente", value: currency(moraPendiente), icon: CircleAlert },
  ];

  const nombreCobrador = cobradorTyped.usuarios?.nombre_completo ?? "—";
  const etiquetaComision =
    TIPOS_COMISION.find((t) => t.value === cobradorTyped.tipo_comision)?.label ?? cobradorTyped.tipo_comision;

  return (
    <div className="space-y-6">
      <Link href="/cobradores" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
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
                  ? "bg-surface-2 text-ink-strong border-border-soft"
                  : "bg-surface-2 text-ink-muted border-border-strong"
              }`}
            >
              {cobradorTyped.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-ink-muted">
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
            {rutas && rutas.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Route className="h-3.5 w-3.5" />
                {rutas.map((r) => r.nombre).join(", ")}
              </span>
            )}
            {cobradorTyped.fecha_ingreso && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Desde {formatoFecha(cobradorTyped.fecha_ingreso)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-accent-text">
              Comisión: {cobradorTyped.porcentaje_comision}% {etiquetaComision.toLowerCase()}
              {comisionEstimada !== null && (
                <span className="text-ink-muted">({currency(comisionEstimada)} acumulado)</span>
              )}
            </span>
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
        <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">{error}</p>
      )}
      {exito && (
        <p className="text-sm text-accent-text bg-accent-chip-bg/50 border border-accent-chip-border rounded-md px-3 py-2">
          {exito}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-ink-muted">
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
          tipoComision={cobradorTyped.tipo_comision}
          porcentajeComision={cobradorTyped.porcentaje_comision}
        />
        <RestablecerPasswordForm cobradorId={cobradorTyped.id} usuarioId={cobradorTyped.usuario_id} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-secondary">Rutas asignadas</h2>
          <AgregarRutaForm cobradorId={cobradorTyped.id} />
        </div>
        {rutas && rutas.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">{r.nombre}</td>
                    <td className="px-4 py-3 text-ink-secondary">{r.activa ? "Activa" : "Inactiva"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-muted text-sm">Sin rutas asignadas todavía.</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-ink-secondary">Clientes asignados ({listaClientes.length})</h2>
          <ReasignarTodosForm
            cobradorOrigenId={cobradorTyped.id}
            nombreCobrador={nombreCobrador}
            cantidadClientes={listaClientes.length}
            otrosCobradores={otrosCobradores}
          />
        </div>
        {listaClientes.length > 0 ? (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface text-ink-muted text-left">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  {otrosCobradores.length > 0 && <th className="px-4 py-3">Reasignar</th>}
                </tr>
              </thead>
              <tbody>
                {listaClientes.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3">{c.nombre_completo}</td>
                    <td className="px-4 py-3 text-ink-secondary">{ESTADO_CLIENTE_LABEL[c.estado] ?? c.estado}</td>
                    {otrosCobradores.length > 0 && (
                      <td className="px-4 py-3">
                        <form action={reasignarCliente} className="flex items-center gap-2">
                          <input type="hidden" name="cliente_id" value={c.id} />
                          <input type="hidden" name="cobrador_origen_id" value={cobradorTyped.id} />
                          <select
                            name="nuevo_cobrador_id"
                            required
                            defaultValue=""
                            className="rounded-md bg-surface-2 border border-border-strong px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="" disabled>
                              Mover a…
                            </option>
                            {otrosCobradores.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.nombre}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="text-xs text-accent-text hover:underline">
                            Mover
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-muted text-sm">Este cobrador aún no tiene clientes asignados.</p>
        )}
      </div>
    </div>
  );
}
