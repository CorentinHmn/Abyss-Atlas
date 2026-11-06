import { getTranslations } from "next-intl/server";
import { MIN_PASSWORD } from "@/lib/passwords";
import { InviteForm } from "./invite-form";

/** SCR-002 */
export default async function InvitePage() {
  const t = await getTranslations("Invite");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <InviteForm minPassword={MIN_PASSWORD} />
    </main>
  );
}
