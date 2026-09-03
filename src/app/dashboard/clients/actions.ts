"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createClientRecord(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("clients").insert({
    full_name: String(formData.get("full_name")),
    phone: String(formData.get("phone") || "") || null,
    email: String(formData.get("email") || "") || null,
    national_id: String(formData.get("national_id") || "") || null,
    address: String(formData.get("address") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });

  if (error) {
    redirect(`/dashboard/clients/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/clients");
  redirect("/dashboard/clients");
}
