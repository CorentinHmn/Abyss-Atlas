"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database/types";

/** Supabase client for the browser; it shares the session cookies with the server. */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_* variables.");
  return createBrowserClient<Database>(url, publishableKey);
}
