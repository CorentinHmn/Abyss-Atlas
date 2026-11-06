import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Account } from "@/lib/session";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

/** NAV-010: top bar of the workspace. */
export async function WorkspaceTopBar({ account }: { account: Account }) {
  const t = await getTranslations("Shell");
  const isAdmin = account.role === "admin";
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/projects" className="text-lg font-extrabold tracking-tight text-brand">
          {t("product")}
        </Link>
        <span className="hidden text-sm text-muted sm:inline" data-testid="organization-name">
          {account.organizationName}
        </span>
        <nav className="flex flex-wrap items-center gap-1" aria-label={t("mainMenu")}>
          <NavLink href="/projects">{t("projects")}</NavLink>
          {isAdmin ? <NavLink href="/org">{t("organization")}</NavLink> : null}
        </nav>
        <div className="ml-auto">
          <UserMenu
            name={account.displayName}
            email={account.email}
            links={[
              { href: "/me", label: t("profile") },
              ...(isAdmin ? [{ href: "/org/accounts", label: t("accounts") }] : []),
            ]}
          />
        </div>
      </div>
    </header>
  );
}
