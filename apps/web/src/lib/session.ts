import { cache } from "react";
import type { Database } from "@/lib/database/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = Database["app"]["Enums"]["member_role"];

export interface Account {
  organizationId: string;
  organizationName: string;
  role: Role;
  displayName: string;
  email: string;
}

export interface Viewer {
  userId: string;
  email: string;
  /** The active account of the person, or null (operator, suspended account, removed account). */
  account: Account | null;
  isOperator: boolean;
}

/** Who is signed in, once per request. Null when nobody is (or Supabase cannot be reached). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return null;
  }
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const [membership, operator] = await Promise.all([
    supabase.schema("app").from("memberships").select("organization_id, role, display_name, email").eq("user_id", userId).maybeSingle(),
    supabase.schema("licensing").rpc("is_operator"),
  ]);
  let account: Account | null = null;
  if (membership.data) {
    const organization = await supabase
      .schema("licensing")
      .from("organizations")
      .select("name")
      .eq("id", membership.data.organization_id)
      .maybeSingle();
    account = {
      organizationId: membership.data.organization_id,
      organizationName: organization.data?.name ?? "",
      role: membership.data.role,
      displayName: membership.data.display_name,
      email: membership.data.email,
    };
  }
  return { userId, email: String(claims?.claims.email ?? ""), account, isOperator: operator.data === true };
});
