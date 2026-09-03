import { createClient } from "@/lib/supabase/server";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: clientesCount }, { count: cobradoresCount }, { data: prestamos }, { data: morasPendientes }] =
    await Promise.all([
      supabase.from("clientes").select("*", { count: "exact", head: true }).eq("estado", "activo"),
      supabase.from("cobradores").select("*", { count: "exact", head: true }).eq("activo", true),
      supabase.from("prestamos").select("estado, saldo_actual, monto_prestado"),
      supabase.from("moras").select("monto_mora").eq("estado", "pendiente"),
    ]);

  const listaPrestamos = prestamos ?? [];
  const activos = listaPrestamos.filter((p) => p.estado === "activo" || p.estado === "en_mora");
  const carteraActiva = activos.reduce((s, p) => s + Number(p.saldo_actual), 0);
  const totalPrestado = listaPrestamos.reduce((s, p) => s + Number(p.monto_prestado), 0);
  const moraTotal = (morasPendientes ?? []).reduce((s, m) => s + Number(m.monto_mora), 0);

  const stats = [
    { label: "Clientes activos", value: String(clientesCount ?? 0) },
    { label: "Cobradores activos", value: String(cobradoresCount ?? 0) },
    { label: "Préstamos activos", value: String(activos.length) },
    { label: "Cartera pendiente", value: currency(carteraActiva) },
    { label: "Total prestado (histórico)", value: currency(totalPrestado) },
    { label: "Mora pendiente", value: currency(moraTotal) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Panel</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className="text-xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
