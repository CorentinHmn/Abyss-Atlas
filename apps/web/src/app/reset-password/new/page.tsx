import { getTranslations } from "next-intl/server";
import { MIN_PASSWORD } from "@/lib/passwords";
import { NewPasswordForm } from "../forms";

/** SCR-003 step 2 */
export default async function NewPasswordPage() {
  const t = await getTranslations("Reset");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">{t("newTitle")}</h1>
      <NewPasswordForm minPassword={MIN_PASSWORD} />
    </main>
  );
}
