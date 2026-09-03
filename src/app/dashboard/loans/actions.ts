"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createLoan(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.from("loans").insert({
    client_id: String(formData.get("client_id")),
    principal_amount: Number(formData.get("principal_amount")),
    interest_rate: Number(formData.get("interest_rate") || 0),
    term_months: Number(formData.get("term_months") || 1),
    payment_frequency: String(formData.get("payment_frequency") || "monthly"),
    start_date: String(formData.get("start_date")),
    notes: String(formData.get("notes") || "") || null,
  });

  if (error) {
    redirect(`/dashboard/loans/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/dashboard/loans");
  redirect("/dashboard/loans");
}

export async function addPayment(formData: FormData) {
  const supabase = await createClient();
  const loanId = String(formData.get("loan_id"));

  const { error } = await supabase.from("payments").insert({
    loan_id: loanId,
    amount: Number(formData.get("amount")),
    payment_date: String(formData.get("payment_date")),
    method: String(formData.get("method") || "") || null,
    notes: String(formData.get("notes") || "") || null,
  });

  if (error) {
    redirect(`/dashboard/loans/${loanId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/loans/${loanId}`);
  redirect(`/dashboard/loans/${loanId}`);
}

export async function updateLoanStatus(formData: FormData) {
  const supabase = await createClient();
  const loanId = String(formData.get("loan_id"));
  const status = String(formData.get("status"));

  await supabase.from("loans").update({ status }).eq("id", loanId);

  revalidatePath(`/dashboard/loans/${loanId}`);
  redirect(`/dashboard/loans/${loanId}`);
}
