"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function crearRuta(formData: FormData) {
  const supabase = await createClient();

  const cobradorId = String(formData.get("cobrador_id") || "");

  const { error } = await supabase.from("rutas").insert({
    nombre: String(formData.get("nombre")),
    zona: String(formData.get("zona") || "") || null,
    cobrador_id: cobradorId || null,
  });

  if (error) {
    redirect(`/rutas/nueva?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/rutas");
  redirect("/rutas");
}
