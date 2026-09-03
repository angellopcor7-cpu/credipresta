import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import { createLoan } from "../actions";

export default async function NewLoanPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .order("full_name");
  const clients = (data ?? []) as Client[];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Nuevo préstamo</h1>

      {clients.length === 0 ? (
        <p className="text-slate-400 text-sm">
          Primero crea un cliente para poder registrar un préstamo.
        </p>
      ) : (
        <form
          action={createLoan}
          className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800"
        >
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="client_id">
              Cliente
            </label>
            <select
              id="client_id"
              name="client_id"
              required
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="principal_amount">
                Monto
              </label>
              <input
                id="principal_amount"
                name="principal_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="interest_rate">
                Interés (%)
              </label>
              <input
                id="interest_rate"
                name="interest_rate"
                type="number"
                step="0.01"
                defaultValue={0}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="term_months">
                Plazo (meses)
              </label>
              <input
                id="term_months"
                name="term_months"
                type="number"
                min="1"
                defaultValue={1}
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300" htmlFor="payment_frequency">
                Frecuencia
              </label>
              <select
                id="payment_frequency"
                name="payment_frequency"
                defaultValue="monthly"
                className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="start_date">
              Fecha de inicio
            </label>
            <input
              id="start_date"
              name="start_date"
              type="date"
              defaultValue={today}
              required
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="notes">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md py-2 text-sm">
            Guardar préstamo
          </button>
        </form>
      )}
    </div>
  );
}
