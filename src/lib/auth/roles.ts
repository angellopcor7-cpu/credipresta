import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_IMPERSONACION } from "@/lib/auth/impersonacion";

/**
 * App privada: ya no hay clientes con cuenta propia (los da de alta el
 * cobrador). Solo quedan dos roles reales: administrador (Empresa: Marco y
 * Camacho) y cobrador. Un administrador también puede actuar como cobrador
 * (tiene su propia fila en `cobradores`) — por eso `cobradorId` no depende
 * del rol, se resuelve aparte.
 */
export type Rol = "administrador" | "cobrador";

export type SesionUsuario = {
  id: string;
  email: string | undefined;
  nombreCompleto: string;
  rol: Rol;
  cobradorId: string | null;
  /**
   * false = este cobrador puede entrar a cobrar (pagos, mora, días extra)
   * pero no puede dar de alta clientes nuevos ni renovar préstamos — pensado
   * para quien solo va a cubrir la ruta de otro cobrador. Empresa lo prende
   * o apaga desde la ficha del cobrador. Un administrador siempre puede.
   */
  puedeDarPrestamos: boolean;
  /**
   * Si no es null, esta sesión en realidad es Empresa "viendo y actuando
   * como" el cobrador de arriba (nombre, cobradorId, puedeDarPrestamos ya
   * son los del cobrador) — guarda quién es Empresa de verdad, para poder
   * mostrar el aviso y el botón de "Salir". La sesión real de Supabase Auth
   * (auth.uid()) sigue siendo la de Empresa en todo momento; nada más se
   * sobreescribe esto a nivel app.
   */
  impersonadoPor: { id: string; nombreCompleto: string } | null;
};

/** A dónde debe ir cada rol al entrar — para no mandar a nadie a una pantalla que no le toca. */
export function rutaInicioPorRol(rol: Rol): string {
  return rol === "administrador" ? "/dashboard" : "/panel";
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
    .select("nombre_completo, activo, roles(nombre), cobradores(id, puede_dar_prestamos)")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) return null;

  const rolNombre = (perfil.roles as unknown as { nombre: string } | null)?.nombre;
  if (rolNombre !== "administrador" && rolNombre !== "cobrador") return null;

  const cobrador = perfil.cobradores as unknown as
    | { id: string; puede_dar_prestamos: boolean }
    | { id: string; puede_dar_prestamos: boolean }[]
    | null;
  const cobradorFila = Array.isArray(cobrador) ? cobrador[0] ?? null : cobrador;

  const sesionReal: SesionUsuario = {
    id: user.id,
    email: user.email,
    nombreCompleto: perfil.nombre_completo,
    rol: rolNombre,
    cobradorId: cobradorFila?.id ?? null,
    // Un administrador sin fila propia de cobrador (todavía no entró a la
    // vista de cobrador) de todos modos puede dar préstamos.
    puedeDarPrestamos: cobradorFila?.puede_dar_prestamos ?? true,
    impersonadoPor: null,
  };

  // Si Empresa está "viendo y actuando como" un cobrador (cookie puesta por
  // `entrarComoCobrador`), se le devuelve la sesión del cobrador en su
  // lugar — pero sin tocar nada de la autenticación real: auth.uid() sigue
  // siendo el de Empresa, así que cualquier política RLS basada en
  // is_admin() sigue dejándolo pasar. Solo aplica si de verdad es
  // administrador; una cookie vieja o inválida simplemente se ignora.
  if (rolNombre === "administrador") {
    const cookieStore = await cookies();
    const cobradorImpersonadoId = cookieStore.get(COOKIE_IMPERSONACION)?.value;

    if (cobradorImpersonadoId) {
      const { data: cobradorImpersonado } = await supabase
        .from("cobradores")
        .select("id, usuario_id, puede_dar_prestamos, activo, usuarios(nombre_completo, activo)")
        .eq("id", cobradorImpersonadoId)
        .maybeSingle();

      const usuarioImpersonado = cobradorImpersonado?.usuarios as unknown as
        | { nombre_completo: string; activo: boolean }
        | { nombre_completo: string; activo: boolean }[]
        | null;
      const usuarioFila = Array.isArray(usuarioImpersonado) ? usuarioImpersonado[0] ?? null : usuarioImpersonado;

      if (cobradorImpersonado && cobradorImpersonado.activo && usuarioFila?.activo) {
        return {
          // Importante: este id es el del COBRADOR impersonado, no el de
          // Empresa — es lo que hace que pagos, solicitudes e historial
          // queden registrados a su nombre. La sesión real de Supabase Auth
          // (auth.uid()) sigue siendo la de Empresa y es la que usan las
          // políticas RLS basadas en is_admin().
          id: cobradorImpersonado.usuario_id,
          email: undefined,
          nombreCompleto: usuarioFila.nombre_completo,
          rol: "cobrador",
          cobradorId: cobradorImpersonado.id,
          puedeDarPrestamos: cobradorImpersonado.puede_dar_prestamos,
          impersonadoPor: { id: sesionReal.id, nombreCompleto: sesionReal.nombreCompleto },
        };
      }
    }
  }

  return sesionReal;
}

/** Exige que haya sesión con rol administrador; si no, redirige a donde sí le toca. */
export async function exigirAdministrador(): Promise<SesionUsuario> {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");
  if (sesion.rol !== "administrador") redirect(rutaInicioPorRol(sesion.rol));
  return sesion;
}

/**
 * Exige que haya sesión con acceso a la vista de cobrador: un cobrador de
 * verdad, o un administrador (Marco/Camacho también cobran clientes). Si el
 * administrador todavía no tiene su propia fila en `cobradores`, se la crea
 * aquí mismo la primera vez que entra a esta vista.
 */
export async function exigirVistaCobrador(): Promise<SesionUsuario & { cobradorId: string }> {
  const sesion = await getSesionUsuario();
  if (!sesion) redirect("/login");

  if (sesion.cobradorId) {
    return { ...sesion, cobradorId: sesion.cobradorId };
  }

  if (sesion.rol !== "administrador") {
    // Un cobrador de verdad siempre debería tener ya su fila; si no, su cuenta está mal configurada.
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: nuevoCobrador, error } = await supabase
    .from("cobradores")
    .insert({ usuario_id: sesion.id, activo: true })
    .select("id")
    .single();

  if (error || !nuevoCobrador) redirect("/dashboard");

  return { ...sesion, cobradorId: nuevoCobrador.id };
}
