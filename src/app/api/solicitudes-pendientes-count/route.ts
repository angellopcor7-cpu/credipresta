import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSesionUsuario } from "@/lib/auth/roles";

/**
 * Lo usa el sidebar del panel de Empresa (AdminSidebar.tsx) para refrescar
 * cada cierto tiempo el número de solicitudes pendientes sin recargar toda
 * la página — así el aviso se mantiene al día aunque Empresa se quede
 * quieta viendo otra pantalla. Es nomás un conteo, pero igual se protege
 * para que solo un administrador lo pueda pedir.
 */
export async function GET() {
  const sesion = await getSesionUsuario();
  if (!sesion || sesion.rol !== "administrador") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("solicitudes_prestamo")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  return NextResponse.json({ count: count ?? 0 });
}
