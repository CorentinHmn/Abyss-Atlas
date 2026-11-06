"use server";

import { revalidatePath } from "next/cache";
import type { Database } from "@/lib/database/types";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { isEmail, normalizeEmail, removeSignIn, sendInvitation } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Role = Database["app"]["Enums"]["member_role"];
const ROLES: Role[] = ["admin", "editor", "viewer"];
const done = (): ActionResult => {
  revalidatePath("/org/accounts");
  return { ok: true };
};

/** ADM-010…ADM-013: checks the credit and the address, invites, then creates the account (which uses the credit). */
export async function createAccount(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as Role;
  if (!isEmail(email) || !name || name.length > 120 || !ROLES.includes(role)) return failure("invalid");

  const supabase = await createSupabaseServerClient();
  const remaining = await supabase.schema("app").rpc("credits_remaining");
  if (remaining.error) return failure(errorKey(remaining.error));
  if ((remaining.data ?? 0) < 1) return failure("noCredit");
  const available = await supabase.schema("app").rpc("email_available", { candidate: email });
  if (available.error) return failure(errorKey(available.error));
  if (!available.data) return failure("emailUnavailable");

  const invitation = await sendInvitation(email, name);
  if (!invitation.ok) return failure(invitation.error);
  const { error } = await supabase
    .schema("app")
    .rpc("add_account", { target: invitation.userId, account_email: email, account_name: name, account_role: role });
  if (error) {
    if (invitation.created) await removeSignIn(invitation.userId);
    return failure(errorKey(error));
  }
  return done();
}

/** ADM-014: only for an invitation not accepted yet. */
export async function resendInvitation(userId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("app").rpc("list_accounts");
  if (error) return failure(errorKey(error));
  const account = data?.find((row) => row.user_id === userId);
  if (!account || account.joined_at || account.status !== "active") return failure("invalid");
  const invitation = await sendInvitation(account.email, account.display_name);
  return invitation.ok ? { ok: true, message: "invitationSent" } : failure(invitation.error);
}

async function call(fn: "suspend_account" | "reactivate_account" | "request_deletion" | "cancel_deletion", userId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc(fn, { target: userId });
  return error ? failure(errorKey(error)) : done();
}

export async function setRole(userId: string, role: Role): Promise<ActionResult> {
  if (!ROLES.includes(role)) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("set_role", { target: userId, new_role: role });
  return error ? failure(errorKey(error)) : done();
}
export const suspendAccount = async (userId: string) => call("suspend_account", userId);
export const reactivateAccount = async (userId: string) => call("reactivate_account", userId);
export const requestDeletion = async (userId: string) => call("request_deletion", userId);
export const cancelDeletion = async (userId: string) => call("cancel_deletion", userId);
