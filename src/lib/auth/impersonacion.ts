/**
 * Nombre de la cookie que guarda, mientras Empresa está "viendo y actuando
 * como" un cobrador específico, el id (de `cobradores`) de a cuál. La
 * sesión real de Supabase Auth NUNCA cambia (sigue siendo la de Empresa) —
 * esta cookie solo hace que `getSesionUsuario()` devuelva los datos del
 * cobrador en su lugar. Por eso cualquier política RLS basada en
 * `is_admin()` (que mira el auth.uid() real) sigue dejando pasar a Empresa
 * tal cual, y las columnas de "quién lo hizo" (registrado_por, creado_por,
 * usuario_id de historial_movimientos, etc.) quedan con el id del cobrador
 * impersonado, como si él mismo lo hubiera hecho.
 */
export const COOKIE_IMPERSONACION = "cp_cobrador_impersonado";
