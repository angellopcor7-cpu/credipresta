import { createClient } from "@/lib/supabase/server";
import { exigirVistaCobrador } from "@/lib/auth/roles";
import { NotificacionesLista } from "@/components/NotificacionesLista";

export default async function NotificacionesCobradorPage() {
  const sesion = await exigirVistaCobrador();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notificaciones")
    .select("id, titulo, cuerpo, url, leida, created_at")
    .eq("usuario_id", sesion.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <p className="text-ink-muted text-sm mt-1">
          Los mismos avisos que te llegan como notificación push, aquí guardados — por si no los viste a tiempo.
        </p>
      </div>
      <NotificacionesLista notificaciones={data ?? []} volverA="/panel/notificaciones" />
    </div>
  );
}
