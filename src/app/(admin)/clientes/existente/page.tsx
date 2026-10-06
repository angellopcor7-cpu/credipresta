import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { crearClienteExistente } from "../actions";

export default async function NuevoClienteExistentePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase
    .from("cobradores")
    .select("id, usuarios(nombre_completo)")
    .eq("activo", true)
    .order("id");
  const cobradores = ((data ?? []) as unknown as { id: string; usuarios: { nombre_completo: string } | null }[]).map(
    (c) => ({ id: c.id, nombre: c.usuarios?.nombre_completo ?? "—" })
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/clientes" className="text-sm text-ink-muted hover:text-ink">
          ← Clientes
        </Link>
        <h1 className="text-2xl font-bold mt-1">Agregar cliente existente</h1>
        <p className="text-ink-muted text-sm mt-1">
          Para clientes que tu negocio ya traía antes de usar la app — que ya tienen un préstamo en curso y puede
          que ya hayan abonado algo. Aquí capturas cómo está su préstamo hoy: cuánto se prestó, cuánto ya pagó y
          cuánta mora lleva, si tiene. El saldo y la mora en la app van a arrancar con esos números, no desde cero.
        </p>
      </div>

      <form action={crearClienteExistente} className="space-y-6">
        <Section title="Datos del cliente">
          <Field label="Nombre completo" name="nombre_completo" required />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Teléfono" name="telefono" />
            <Field label="Identificación" name="identificacion" />
          </div>
          <Field label="Dirección" name="direccion" />
          <Field label="Referencia personal" name="referencia_personal" />

          <div className="space-y-1">
            <label className="text-sm text-ink-secondary" htmlFor="cobrador_id">
              Cobrador asignado
            </label>
            <select
              id="cobrador_id"
              name="cobrador_id"
              required
              defaultValue=""
              className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="" disabled>
                Elige un cobrador
              </option>
              {cobradores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <Textarea label="Notas (opcional)" name="notas" />
        </Section>

        <Section title="El préstamo, como estaba antes de usar la app">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Monto prestado" name="monto_prestado" type="number" step="0.01" required />
            <Field
              label="% de interés total"
              name="porcentaje_interes"
              type="number"
              step="0.01"
              required
              hint="El total ya acordado con el cliente, no el diario. Ej. 20 = 20%."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Plazo en días" name="plazo_dias" type="number" required />
            <Field
              label="Fecha en que se prestó"
              name="fecha_inicio"
              type="date"
              required
              hint="La fecha real en que le entregaron el dinero al cliente."
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-ink-secondary" htmlFor="metodo_pago">
                Método de pago
              </label>
              <select
                id="metodo_pago"
                name="metodo_pago"
                defaultValue="efectivo"
                className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <Field label="Datos de transferencia (si aplica)" name="datos_transferencia" />
          </div>
        </Section>

        <Section title="Cómo está hoy">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field
              label="Ya abonado hasta hoy"
              name="monto_abonado"
              type="number"
              step="0.01"
              defaultValue="0"
              hint="Cuánto del total con intereses ya ha pagado el cliente."
            />
            <Field
              label="Mora acumulada actual"
              name="mora_acumulada"
              type="number"
              step="0.01"
              defaultValue="0"
              hint="Déjalo en 0 si no tiene mora pendiente."
            />
          </div>
          <Field
            label="Días de atraso actuales"
            name="dias_atraso"
            type="number"
            hint="Solo si ya tiene mora: cuántos días lleva sin pagar hasta hoy."
          />
        </Section>

        {error && (
          <p className="text-sm text-danger-text bg-danger-chip-bg/50 border border-danger-chip-border rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-md py-2.5 text-sm">
          Agregar cliente existente
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 bg-surface p-6 rounded-xl border border-border">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  hint,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-ink-secondary" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function Textarea({ label, name, hint }: { label: string; name: string; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-ink-secondary" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        className="w-full rounded-md bg-surface-2 border border-border-strong px-3 py-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
