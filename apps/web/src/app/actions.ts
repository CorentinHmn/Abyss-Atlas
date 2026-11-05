"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { error: "invalidCredentials" | "unavailable" } | null;

export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "invalidCredentials" };

  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return { error: "unavailable" };
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.status === 400 ? "invalidCredentials" : "unavailable" };
    }
  } catch {
    return { error: "unavailable" };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
