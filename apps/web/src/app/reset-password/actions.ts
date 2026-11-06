"use server";

import { redirect } from "next/navigation";
import { MIN_PASSWORD } from "@/lib/passwords";
import { type ActionResult, failure } from "@/lib/errors";
import { isEmail, normalizeEmail } from "@/lib/invitations";
import { siteOrigin } from "@/lib/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** SCR-003 step 1: always the same answer, whether the address has an account or not. */
export async function requestReset(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(formData.get("email"));
  if (!isEmail(email)) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password/new`,
  });
  if (error && error.status !== 400 && error.status !== 404) console.error("[reset] Supabase Auth error:", error.status, error.code);
  return { ok: true, message: "sent" };
}

/** SCR-003 step 2 */
export async function setNewPassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD || password !== String(formData.get("confirm") ?? "")) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return failure("expiredLink");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return failure(error.code === "same_password" || error.code === "weak_password" ? "invalid" : "unavailable");
  redirect("/");
}
