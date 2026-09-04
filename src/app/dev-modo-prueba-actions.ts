"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Botón de modo prueba: cierra la sesión actual (si hay una) e inicia sesión
 * con una cuenta de prueba fija, para poder ver la app como cliente o como
 * cobrador sin tener que cerrar sesión y volver a escribir credenciales cada
 * vez. Pensado solo para pruebas mientras se construye la app.
 */
async function entrarComoPrueba(email: string, ruta: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: "PruebaCredi2026!",
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent("No se pudo entrar al modo prueba: " + error.message)}`);
  }
  redirect(ruta);
}

export async function entrarComoClienteDePrueba() {
  await entrarComoPrueba("prueba.cliente@credipresta.test", "/cliente");
}

/** En CrediPresta, administrador y cobrador son la misma persona: esta vista es el panel de negocio (/dashboard). */
export async function entrarComoNegocioDePrueba() {
  await entrarComoPrueba("prueba.admin@credipresta.test", "/dashboard");
}
