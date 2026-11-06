import { NextResponse, type NextRequest } from "next/server";
import { siteOrigin } from "@/lib/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Links sent by e-mail (password reset) come back here with a one-time code, exchanged for a session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  // Only paths inside Atlas, never another site; on the address the user is on, where the session cookies live.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const origin = await siteOrigin();
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }
  return NextResponse.redirect(`${origin}/reset-password?expired=1`);
}
