"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { MIN_PASSWORD } from "@/lib/passwords";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export async function saveDisplayName(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 120) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("set_my_display_name", { new_name: name });
  if (error) return failure(errorKey(error));
  revalidatePath("/", "layout");
  return { ok: true, message: "nameSaved" };
}

export async function changePassword(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD || password !== String(formData.get("confirm") ?? "")) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? failure(error.code === "same_password" || error.code === "weak_password" ? "invalid" : "unavailable") : { ok: true, message: "passwordSaved" };
}

export async function signOutOtherSessions(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  return error ? failure("unavailable") : { ok: true, message: "othersSignedOut" };
}
