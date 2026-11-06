"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const done = (): ActionResult => {
  revalidatePath("/org/domains");
  return { ok: true };
};

/** ADM-050, ADM-053: creates or changes a domain; its code never changes. */
export async function saveDomain(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const owner = String(formData.get("owner") ?? "").trim();
  const stewards = formData.getAll("stewards").map(String);
  if (!/^[A-Z0-9]{2,5}$/.test(code)) return failure("domainCode");
  if (!name || name.length > 120 || !owner) return failure("invalid");
  if (stewards.length === 0) return failure("noSteward");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("save_domain", {
    domain_code: code,
    domain_name: name,
    domain_description: String(formData.get("description") ?? "").trim().slice(0, 2000),
    owner,
    stewards,
  });
  return error ? failure(errorKey(error)) : done();
}

/** ADM-052 */
export async function setRetired(code: string, retired: boolean): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("set_domain_retired", { domain_code: code, retired });
  return error ? failure(errorKey(error)) : done();
}

/** ADM-052, MM-025: only when no model, rule or value mapping uses it. */
export async function deleteDomain(code: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("delete_domain", { domain_code: code });
  return error ? failure(errorKey(error)) : done();
}
