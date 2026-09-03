"use server";

/**
 * SOLO PARA PRUEBAS — borrar este archivo, el componente
 * `DevModoPrueba` y su uso en `layout.tsx` cuando la app esté terminada.
 *
 * Usa 2 cuentas de prueba dedicadas (creadas directamente en Supabase,
 * NO son la cuenta real de nadie) para saltar entre las vistas de
 * administrador y cobrador con un clic, sin tocar el login real.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const PASSWORD_PRUEBA = "PruebaCredi2026!";

export async function entrarComoAdminDePrueba() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({
    email: "prueba.admin@credipresta.test",
    password: PASSWORD_PRUEBA,
  });
  redirect("/dashboard");
}

export async function entrarComoCobradorDePrueba() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await supabase.auth.signInWithPassword({
    email: "prueba.cobrador@credipresta.test",
    password: PASSWORD_PRUEBA,
  });
  redirect("/panel");
}
