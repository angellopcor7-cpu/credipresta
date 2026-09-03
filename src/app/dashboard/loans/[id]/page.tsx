import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LoanWithClient, Payment, LoanBalance } from "@/lib/types";
import { addPayment, updateLoanStatus } from "../actions";

function currency(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export default async function LoanDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: loan }, { data: payments }, { data: balance }] =
    await Promise.all([
      supabase.from("loans").select("*, clients(full_name)").eq("id", id).single(),
      supabase
        .from("payments")
        .select("*")
        .eq("loan_id", id)
        .order("payment_date", { ascending: false }),
      supabase.from("loan_balances").select("*").eq("loan_id", id).single(),
    ]);

  if (!loan) notFound();

  const loanData = loan as unknown as LoanWithClient;
  const paymentList = (payments ?? []) as Payment[];
  const bal = balance as LoanBalance | null;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-slate-400 text-sm">{loanData.clients?.full_name}</p>
        <h1 className="text-2xl font-bold">
          {currency(Number(loanData.principal_amount))}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Saldo pendiente" value={currency(Number(bal?.balance ?? loanData.principal_amount))} />
        <Stat label="Total pagado" value={currency(Number(bal?.total_paid ?? 0))} />
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-2">Estado</p>
          <form action={updateLoanStatus} className="flex gap-2">
            <input type="hidden" name="loan_id" value={id} />
            <select
              name="status"
              defaultValue={loanData.status}
              className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white text-sm"
            >
              <option value="active">Activo</option>
              <option value="paid">Pagado</option>
              <option value="overdue">Vencido</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <button className="text-xs bg-slate-800 hover:bg-slate-700 rounded-md px-2">
              Guardar
            </button>
          </form>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="font-semibold">Registrar pago</h2>
          <form
            action={addPayment}
            className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
          >
            <input type="hidden" name="loan_id" value={id} />
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="amount">
                Monto
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="payment_date">
                Fecha
              </label>
              <input
                id="payment_date"
                name="payment_date"
                type="date"
                defaultValue={today}
                required
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="method">
                Método
              </label>
              <input
                id="method"
                name="method"
                placeholder="Efectivo, transferencia..."
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
              Agregar pago
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h2 className="font-semibold">Historial de pagos</h2>
          {paymentList.length === 0 ? (
            <p className="text-slate-400 text-sm">Sin pagos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {paymentList.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm"
                >
                  <span className="text-slate-300">{p.payment_date}</span>
                  <span className="font-medium">{currency(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-slate-400 text-xs">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}
