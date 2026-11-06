import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavLink } from "./nav-link";
import { UserMenu } from "./user-menu";

/** NAV-030, NAV-031: the control tower has its own bar and accent color. */
export async function ControlTopBar({ email }: { email: string }) {
  const t = await getTranslations("Shell");
  return (
    <header className="border-b-2 border-control bg-surface">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/control" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-control">
          {t("product")}
          <span className="whitespace-nowrap rounded bg-control px-1.5 py-0.5 text-xs font-bold text-paper">{t("controlTower")}</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label={t("mainMenu")}>
          <NavLink href="/control" exact>
            {t("organizations")}
          </NavLink>
          <NavLink href="/control/audit">{t("auditLog")}</NavLink>
          <NavLink href="/progress">{t("progress")}</NavLink>
        </nav>
        <div className="ml-auto">
          <UserMenu name={t("operator")} email={email} links={[]} />
        </div>
      </div>
    </header>
  );
}
