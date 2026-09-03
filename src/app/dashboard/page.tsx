import { createClient } from "@/lib/supabase/server";
import type { LoanBalance } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: clientCount }, { data: balances }] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("loan_balances").select("*"),
  ]);

  const rows = (balances ?? []) as LoanBalance[];
  const activeLoans = rows.filter((r) => r.status === "active");
  const totalLent = rows.reduce((sum, r) => sum + Number(r.principal_amount), 0);
  const totalCollected = rows.reduce((sum, r) => sum + Number(r.total_paid), 0);
  const totalOutstanding = rows.reduce((sum, r) => sum + Number(r.balance), 0);

  const stats = [
    { label: "Clientes", value: String(clientCount ?? 0) },
    { label: "Préstamos activos", value: String(activeLoans.length) },
    { label: "Total prestado", value: currency(totalLent) },
    { label: "Total cobrado", value: currency(totalCollected) },
    { label: "Saldo pendiente", value: currency(totalOutstanding) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Panel</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <p className="text-slate-400 text-xs">{s.label}</p>
            <p className="text-xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
