import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Signed in, but without an active account: suspended, waiting for deletion, or removed (ADM-018). */
export default async function NoAccessPage() {
  const t = await getTranslations("NoAccess");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted">{t("body")}</p>
      <form action={signOut}>
        <Button type="submit" variant="secondary">
          {t("signOut")}
        </Button>
      </form>
    </main>
  );
}
