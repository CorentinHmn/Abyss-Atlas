import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ErrorKey } from "@/lib/errors";
import { siteOrigin } from "@/lib/origin";

/**
 * Sends (or sends again) the invitation e-mail of Supabase Auth. Returns the invited user's id, and whether that
 * sign-in was created by this call (so that it can be removed if the account cannot be created).
 */
export async function sendInvitation(
  email: string,
  displayName: string,
): Promise<{ ok: true; userId: string; created: boolean } | { ok: false; error: ErrorKey }> {
  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch (cause) {
    console.error("[invitation] Admin client unavailable:", cause instanceof Error ? cause.message : cause);
    return { ok: false, error: "unavailable" };
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${await siteOrigin()}/invite`,
    data: { display_name: displayName },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.status === 422) return { ok: false, error: "emailUnavailable" };
    console.error("[invitation] Supabase Auth error:", error?.status, error?.code);
    return { ok: false, error: "unavailable" };
  }
  const created = Date.now() - new Date(data.user.created_at).getTime() < 60_000;
  return { ok: true, userId: data.user.id, created };
}

/** Removes a sign-in that was just created for an account that could not be created. */
export async function removeSignIn(userId: string): Promise<void> {
  try {
    await createSupabaseAdminClient().auth.admin.deleteUser(userId);
  } catch (cause) {
    console.error("[invitation] Could not remove an unused sign-in:", cause instanceof Error ? cause.message : cause);
  }
}

export function normalizeEmail(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
