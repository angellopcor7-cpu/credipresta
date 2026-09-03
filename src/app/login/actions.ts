"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Solo login — no hay auto-registro público. Las cuentas de cobradores las
 * crea un administrador desde el panel (ver /cobradores/nuevo), y el primer
 * administrador se creó directamente en la base de datos.
 */
export async function signIn(formData: FormData) {
  const email = String(formData.get("email"));
  const password = String(formData.get("password"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("Correo o contraseña incorrectos")}`);
  }

  redirect("/dashboard");
}
