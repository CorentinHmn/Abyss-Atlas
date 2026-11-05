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
  } catch (cause) {
    // Logged without any user data: typically missing NEXT_PUBLIC_SUPABASE_* variables at build time.
    console.error("[sign-in] Supabase client unavailable:", cause instanceof Error ? cause.message : cause);
    return { error: "unavailable" };
  }
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400) return { error: "invalidCredentials" };
      console.error("[sign-in] Supabase auth error:", error.status, error.code);
      return { error: "unavailable" };
    }
  } catch (cause) {
    console.error("[sign-in] Supabase unreachable:", cause instanceof Error ? cause.message : cause);
    return { error: "unavailable" };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
