import { createClient } from "@/lib/supabase/server";
import { NuevoPrestamoForm } from "./NuevoPrestamoForm";

export default async function NuevoPrestamoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: clientes }, { data: cobradores }] = await Promise.all([
    supabase.from("clientes").select("id, nombre_completo").eq("estado", "activo").order("nombre_completo"),
    supabase.from("cobradores").select("id, usuarios(nombre_completo)").eq("activo", true),
  ]);

  const listaCobradores = (cobradores ?? []) as unknown as Array<{
    id: string;
    usuarios: { nombre_completo: string } | null;
  }>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Nuevo préstamo</h1>
      <NuevoPrestamoForm clientes={clientes ?? []} cobradores={listaCobradores} error={error} />
    </div>
  );
}
