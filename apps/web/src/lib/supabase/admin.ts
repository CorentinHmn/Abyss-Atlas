import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { supabaseEnv } from "./env";
import { fetchWithTimeout } from "./server";

/**
 * Supabase client with the secret key, for the few Auth operations a user session cannot do: sending invitations
 * and removing a sign-in whose account could not be created. Server only; never used to read customer content.
 * The secret key (SUPABASE_SECRET_KEY) is set in Vercel by the founder and never reaches the browser.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") throw new Error("The admin client is server only.");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY (see apps/web/.env.example).");
  return createClient<Database>(supabaseEnv().url, secretKey, {
    global: { fetch: fetchWithTimeout },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
