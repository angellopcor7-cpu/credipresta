import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la llave `service_role` — se salta Row Level
 * Security por completo. SOLO se usa en el servidor (Server Actions / Route
 * Handlers), NUNCA se importa desde código que corra en el navegador, y
 * NUNCA se expone su llave con el prefijo NEXT_PUBLIC_.
 *
 * Se usa exclusivamente para operaciones administrativas que la API normal
 * de Supabase Auth no permite hacer como usuario logueado, como crear la
 * cuenta de un cobrador nuevo.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor. " +
        "Cópiala desde Supabase → Project Settings → API → service_role, y agrégala " +
        "SIN el prefijo NEXT_PUBLIC_ (debe quedar solo en el servidor)."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
