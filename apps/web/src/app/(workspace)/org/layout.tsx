import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { NavLink } from "@/components/shell/nav-link";
import { getViewer } from "@/lib/session";

/** The organization area: licenses and accounts (SCR-080) and the catalogue of domains (SCR-081). */
export default async function OrganizationLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Shell");
  const viewer = await getViewer();
  return (
    <div className="flex flex-col gap-6">
      {viewer?.account?.role === "admin" ? (
        <nav className="flex flex-wrap gap-1 border-b border-line pb-2" aria-label={t("organization")}>
          <NavLink href="/org/accounts">{t("accounts")}</NavLink>
          <NavLink href="/org/domains">{t("domains")}</NavLink>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
