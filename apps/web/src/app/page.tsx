import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

async function currentEmail(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const t = await getTranslations("Home");
  const email = await currentEmail();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight text-brand">{t("title")}</h1>
        <p className="text-lg text-muted">{t("tagline")}</p>
      </div>

      {email ? (
        <form action={signOut} className="flex flex-wrap items-center gap-4">
          <span>{t("signedInAs", { email })}</span>
          <button type="submit" className="rounded-md border border-line px-4 py-2 hover:border-brand">
            {t("signOut")}
          </button>
        </form>
      ) : (
        <Link href="/sign-in" className="w-fit rounded-md bg-brand px-4 py-2 font-semibold text-paper">
          {t("signIn")}
        </Link>
      )}

      <p className="text-sm text-muted">{t("status")}</p>
    </main>
  );
}
