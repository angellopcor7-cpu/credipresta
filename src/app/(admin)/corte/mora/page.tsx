import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ChevronLeft, CircleAlert } from "lucide-react";
import { claveSemana, lunesDeHoy, domingoDe, formatoRangoSemana } from "@/lib/fechas";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

type FilaClienteMora = {
  prestamoId: string;
  clienteId: string;
  nombreCliente: string;
  telefono: string | null;
  nombreCobrador: string;
  moraGeneradaSemana: number;
  moraAcumuladaActual: number;
};

/**
 * Drill-down del cuadro "Mora generada esta semana" de /corte: lista a todos
 * los clientes a los que se les generó mora en la semana consultada, con su
 * cobrador y su mora acumulada actual, para que Empresa pueda ver de un
 * vistazo a quién hay que seguirle de cerca.
 */
export default async function MoraSemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const claveLunesSolicitada = semana && /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : lunesDeHoy();
  const claveLunes = claveSemana(claveLunesSolicitada);
  const claveDomingo = domingoDe(claveLunes);

  const supabase = await createClient();

  const { data: morasData } = await supabase
    .from("moras")
    .select("monto_mora, prestamo_id")
    .gte("fecha_generada", claveLunes)
    .lte("fecha_generada", claveDomingo);

  const moras = morasData ?? [];
  const prestamoIds = Array.from(new Set(moras.map((m) => m.prestamo_id)));

  const { data: prestamosData } =
    prestamoIds.length > 0
      ? await supabase
          .from("prestamos")
          .select("id, cliente_id, cobrador_id, mora_acumulada")
          .in("id", prestamoIds)
      : { data: [] };

  const prestamos = prestamosData ?? [];
  const clienteIds = Array.from(new Set(prestamos.map((p) => p.cliente_id)));
  const cobradorIds = Array.from(new Set(prestamos.map((p) => p.cobrador_id).filter((id): id is string => !!id)));

  const [{ data: clientesData }, { data: cobradoresData }] = await Promise.all([
    clienteIds.length > 0
      ? supabase.from("clientes").select("id, nombre_completo, telefono").in("id", clienteIds)
      : Promise.resolve({ data: [] }),
    cobradorIds.length > 0
      ? supabase.from("cobradores").select("id, usuarios(nombre_completo)").in("id", cobradorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const clientesPorId = new Map((clientesData ?? []).map((c) => [c.id, c]));
  const cobradoresPorId = new Map(
    (cobradoresData ?? []).map((c) => [
      c.id,
      (c as unknown as { usuarios: { nombre_completo: string } | null }).usuarios?.nombre_completo ?? "—",
    ])
  );
  const prestamoPorId = new Map(prestamos.map((p) => [p.id, p]));

  const acumuladoPorPrestamo = new Map<string, number>();
  for (const m of moras) {
    acumuladoPorPrestamo.set(m.prestamo_id, (acumuladoPorPrestamo.get(m.prestamo_id) ?? 0) + Number(m.monto_mora));
  }

  const filas: FilaClienteMora[] = Array.from(acumuladoPorPrestamo.entries())
    .map(([prestamoId, moraGeneradaSemana]) => {
      const prestamo = prestamoPorId.get(prestamoId);
      const cliente = prestamo ? clientesPorId.get(prestamo.cliente_id) : undefined;
      return {
        prestamoId,
        clienteId: prestamo?.cliente_id ?? "",
        nombreCliente: cliente?.nombre_completo ?? "—",
        telefono: cliente?.telefono ?? null,
        nombreCobrador: prestamo?.cobrador_id ? cobradoresPorId.get(prestamo.cobrador_id) ?? "—" : "—",
        moraGeneradaSemana,
        moraAcumuladaActual: Number(prestamo?.mora_acumulada ?? 0),
      };
    })
    .sort((a, b) => b.moraGeneradaSemana - a.moraGeneradaSemana);

  return (
    <div className="space-y-6">
      <Link
        href={`/corte?semana=${claveLunes}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        Corte semanal
      </Link>

      <div className="flex items-center gap-2">
        <CircleAlert className="h-5 w-5 text-danger-text" />
        <h1 className="text-2xl font-bold">Clientes con mora generada esta semana</h1>
      </div>
      <p className="text-ink-muted text-sm -mt-4">{formatoRangoSemana(claveLunes)}</p>

      {filas.length === 0 ? (
        <p className="text-ink-muted text-sm">Nadie generó mora nueva esta semana.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-muted text-left">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3">Mora generada esta semana</th>
                <th className="px-4 py-3">Mora acumulada actual</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.prestamoId} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{f.nombreCliente}</td>
                  <td className="px-4 py-3 text-ink-secondary">{f.telefono ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-secondary">{f.nombreCobrador}</td>
                  <td className="px-4 py-3 text-danger-text">{currency(f.moraGeneradaSemana)}</td>
                  <td className="px-4 py-3 text-danger-text font-medium">{currency(f.moraAcumuladaActual)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/prestamos/${f.prestamoId}`} className="text-xs text-accent-text hover:underline">
                      Ver préstamo
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
