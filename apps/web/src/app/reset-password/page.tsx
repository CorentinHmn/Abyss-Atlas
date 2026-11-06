import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { RequestResetForm } from "./forms";

/** SCR-003 step 1 */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const t = await getTranslations("Reset");
  const expired = (await searchParams).expired === "1";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {expired ? <Alert>{t("expired")}</Alert> : <p className="text-sm text-muted">{t("intro")}</p>}
      <RequestResetForm />
      <Link href="/sign-in" className="text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
    </main>
  );
}
