"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { isEmail, normalizeEmail, removeSignIn, sendInvitation } from "@/lib/invitations";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readCredits(value: FormDataEntryValue | null): number | null {
  const credits = Number(String(value ?? ""));
  return Number.isInteger(credits) && credits >= 0 && credits <= 100_000 ? credits : null;
}

/** CT-012: invites the first Admin; the e-mail is not kept by the control tower. */
async function inviteFirstAdminOf(organizationId: string, name: string, email: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const available = await supabase.schema("app").rpc("email_available", { candidate: email });
  if (available.error) return failure(errorKey(available.error));
  if (!available.data) return failure("emailUnavailable");
  const invitation = await sendInvitation(email, name);
  if (!invitation.ok) return failure(invitation.error);
  const { error } = await supabase
    .schema("licensing")
    .rpc("add_first_admin", { org: organizationId, target: invitation.userId, admin_email: email, admin_name: name });
  if (error) {
    if (invitation.created) await removeSignIn(invitation.userId);
    return failure(errorKey(error));
  }
  return { ok: true };
}

/** CT-011, CT-012 */
export async function createOrganization(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const credits = readCredits(formData.get("credits"));
  const adminName = String(formData.get("adminName") ?? "").trim();
  const adminEmail = normalizeEmail(formData.get("adminEmail"));
  if (!name || name.length > 120 || credits === null || !adminName || !isEmail(adminEmail)) return failure("invalid");
  if (credits < 1) return failure("minimumCredit");

  const supabase = await createSupabaseServerClient();
  const available = await supabase.schema("app").rpc("email_available", { candidate: adminEmail });
  if (available.error) return failure(errorKey(available.error));
  if (!available.data) return failure("emailUnavailable");
  const created = await supabase.schema("licensing").rpc("create_organization", { org_name: name, credits });
  if (created.error || !created.data) return failure(errorKey(created.error));
  const invited = await inviteFirstAdminOf(created.data, adminName, adminEmail);
  revalidatePath("/control");
  if (!invited?.ok) redirect(`/control/o/${created.data}?invite=failed`);
  redirect(`/control/o/${created.data}`);
}

/** CT-012, again, when the first invitation could not be sent. */
export async function inviteFirstAdmin(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const organizationId = String(formData.get("organization") ?? "");
  const name = String(formData.get("adminName") ?? "").trim();
  const email = normalizeEmail(formData.get("adminEmail"));
  if (!organizationId || !name || !isEmail(email)) return failure("invalid");
  const result = await inviteFirstAdminOf(organizationId, name, email);
  revalidatePath(`/control/o/${organizationId}`);
  return result;
}

/** CT-013 */
export async function setCredits(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const organizationId = String(formData.get("organization") ?? "");
  const credits = readCredits(formData.get("credits"));
  if (!organizationId || credits === null) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("licensing").rpc("set_credits", { org: organizationId, credits });
  if (error) return failure(errorKey(error));
  revalidatePath(`/control/o/${organizationId}`);
  return { ok: true, message: "creditsSaved" };
}

/** CT-014 */
export async function renameOrganization(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const organizationId = String(formData.get("organization") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!organizationId || !name || name.length > 120) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("licensing").rpc("rename_organization", { org: organizationId, new_name: name });
  if (error) return failure(errorKey(error));
  revalidatePath(`/control/o/${organizationId}`);
  return { ok: true, message: "renamed" };
}

/** CT-021 */
export async function validateDeletions(organizationId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.schema("licensing").rpc("validate_deletions", { org: organizationId });
  if (error) return failure(errorKey(error));
  revalidatePath(`/control/o/${organizationId}`);
  return { ok: true, message: data === 1 ? "deletionValidated" : "deletionsValidated" };
}
