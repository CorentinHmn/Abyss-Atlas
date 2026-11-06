import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/session";

/** NAV-013: signed-in users go to their area; visitors see the sign-in invitation. */
export default async function HomePage() {
  const viewer = await getViewer();
  if (viewer) redirect(viewer.account ? "/projects" : viewer.isOperator ? "/control" : "/no-access");
  const t = await getTranslations("Home");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-extrabold tracking-tight text-brand">{t("title")}</h1>
        <p className="text-lg text-muted">{t("tagline")}</p>
      </div>
      <Link href="/sign-in" className="w-fit rounded-md bg-brand px-4 py-2 font-semibold text-paper">
        {t("signIn")}
      </Link>
    </main>
  );
}
