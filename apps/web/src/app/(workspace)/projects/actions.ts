"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, errorKey, failure } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ADM-040 */
export async function createProject(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name || name.length > 120) return failure("invalid");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.schema("app").rpc("create_project", { project_name: name, project_description: description });
  if (error) return failure(errorKey(error));
  revalidatePath("/projects");
  return { ok: true };
}
