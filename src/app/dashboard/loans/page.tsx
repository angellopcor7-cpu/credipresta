import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { LoanWithClient, LoanBalance } from "@/lib/types";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

const statusLabel: Record<string, string> = {
  active: "Activo",
  paid: "Pagado",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const statusColor: Record<string, string> = {
  active: "bg-emerald-950 text-emerald-400 border-emerald-900",
  paid: "bg-slate-800 text-slate-300 border-slate-700",
  overdue: "bg-red-950 text-red-400 border-red-900",
  cancelled: "bg-slate-800 text-slate-500 border-slate-700",
};

export default async function LoansPage() {
  const supabase = await createClient();

  const [{ data: loans }, { data: balances }] = await Promise.all([
    supabase
      .from("loans")
      .select("*, clients(full_name)")
      .order("created_at", { ascending: false }),
    supabase.from("loan_balances").select("*"),
  ]);

  const loanList = (loans ?? []) as unknown as LoanWithClient[];
  const balanceMap = new Map(
    ((balances ?? []) as LoanBalance[]).map((b) => [b.loan_id, b])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Préstamos</h1>
        <Link
          href="/dashboard/loans/new"
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-md"
        >
          + Nuevo préstamo
        </Link>
      </div>

      {loanList.length === 0 ? (
        <p className="text-slate-400 text-sm">Aún no hay préstamos.</p>
      ) : (
        <div className="border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Monto</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loanList.map((loan) => {
                const balance = balanceMap.get(loan.id);
                return (
                  <tr key={loan.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">
                      {loan.clients?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {currency(Number(loan.principal_amount))}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {currency(Number(balance?.balance ?? loan.principal_amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs border rounded-full px-2 py-1 ${statusColor[loan.status]}`}
                      >
                        {statusLabel[loan.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/loans/${loan.id}`}
                        className="text-emerald-400 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
