"use server";

import { redirect } from "next/navigation";
import { MIN_PASSWORD } from "@/lib/passwords";
import { type ActionResult, failure } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** SCR-002: sets the password and the display name, marks the account as joined (ADM-012). */
export async function acceptInvitation(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || name.length > 120 || password.length < MIN_PASSWORD || password !== String(formData.get("confirm") ?? "")) {
    return failure("invalid");
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return failure("expiredLink");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return failure(error.code === "weak_password" ? "invalid" : "unavailable");
  await supabase.schema("app").rpc("set_my_display_name", { new_name: name });
  await supabase.schema("app").rpc("mark_joined");
  redirect("/");
}
