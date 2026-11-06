import { getTranslations } from "next-intl/server";
import { getViewer } from "@/lib/session";
import { MIN_PASSWORD } from "@/lib/passwords";
import { ProfileForms } from "./profile-forms";

/** SCR-090 */
export default async function ProfilePage() {
  const viewer = await getViewer();
  const t = await getTranslations("Profile");
  const roles = await getTranslations("Roles");
  const account = viewer?.account;
  if (!account) return null;
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted">{t("summary", { email: account.email, role: roles(account.role), organization: account.organizationName })}</p>
      </div>
      <ProfileForms displayName={account.displayName} minPassword={MIN_PASSWORD} />
    </div>
  );
}
