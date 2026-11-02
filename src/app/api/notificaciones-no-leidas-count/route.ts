import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSesionUsuario } from "@/lib/auth/roles";

/**
 * Lo usan el sidebar de Empresa y el nav del cobrador para refrescar el
 * numerito de "Notificaciones" sin recargar toda la página (mismo patrón
 * que /api/solicitudes-pendientes-count). Sirve para cualquier sesión
 * válida (administrador o cobrador, incluyendo impersonación), cada quien
 * ve solo su propio conteo.
 */
export async function GET() {
  const sesion = await getSesionUsuario();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("notificaciones")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", sesion.id)
    .eq("leida", false);

  return NextResponse.json({ count: count ?? 0 });
}
