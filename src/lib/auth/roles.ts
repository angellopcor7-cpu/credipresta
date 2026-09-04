import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rol = "administrador" | "cobrador" | "cliente";

export type SesionUsuario = {
  id: string;
  email: string | undefined;
  nombreCompleto: string;
  rol: Rol;
  cobradorId: string | null;
};

/** A dónde debe ir cada rol al entrar — para no mandar a nadie a una pantalla que no le toca. */
export function rutaInicioPorRol(rol: Rol): string {
  if (rol === "administrador") return "/dashboard";
  if (rol === "cobrador") return "/panel";
  return "/cliente";
}

/**
 * Carga el usuario autenticado junto con su rol y (si aplica) su id de
 * cobrador. Si no hay sesión, o el usuario no tiene un perfil en `usuarios`
 * (cuenta a medio crear, o desactivada), regresa null — quien llame decide
 * si eso significa mandar a /login.
 */
export async function getSesionUsuario(): Promise<SesionUsuario | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("nombre_completo, activo, roles(nombre), cobradores(id)")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) return null;

  const rolNombre = (perfil.roles as unknown as { nombre: string } | null)?.nombre;
  if (rolNombre !== "administrador" && rolNombre !== "cobrador" && rolNombre !== "cliente") return null;

  const cobrador = perfil.cobradores as unknown as { id: string } | { id: string }[] | null;
  const cobradorId = Array.isArray(cobrador) ? cobrador[0]?.id ?? null : cobrador?.id ?? null;

  return {
    id: user.id,
    email: user.email,
    nombreCompleto: perfil.nombre_completo,
    rol: rolNombre,
    cobradorId,
  };
}

/** Exige que haya sesión con rol administrador; si no, redirige a donde sí le toca. */
export async function exigirAdministrador(): Promise<SesionUsuario> {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "administrador") redirect(rutaInicioPorRol(sesion.rol));
  return sesion;
}

/** Exige que haya sesión con rol cobrador; si no, redirige a donde sí le toca. */
export async function exigirCobrador(): Promise<SesionUsuario> {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "cobrador") redirect(rutaInicioPorRol(sesion.rol));
  return sesion;
}

/** Exige que haya sesión con rol cliente; si no, redirige a donde sí le toca. */
export async function exigirCliente(): Promise<SesionUsuario> {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/cliente/login");
  if (sesion.rol !== "cliente") redirect(rutaInicioPorRol(sesion.rol));
  return sesion;
}
