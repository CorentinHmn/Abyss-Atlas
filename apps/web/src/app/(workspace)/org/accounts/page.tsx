import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getViewer } from "@/lib/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountActions } from "./account-actions";
import { NewAccountDialog } from "./new-account-dialog";

/** SCR-080: license counter and accounts (Admins). */
export default async function AccountsPage() {
  const viewer = await getViewer();
  if (viewer?.account?.role !== "admin") notFound();
  const t = await getTranslations("Accounts");
  const roles = await getTranslations("Roles");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const [counter, accounts] = await Promise.all([supabase.schema("app").rpc("license_counter"), supabase.schema("app").rpc("list_accounts")]);
  const figures = counter.data?.[0] ?? { credits_granted: 0, credits_used: 0, credits_remaining: 0, waiting_for_deletion: 0 };

  const tiles = [
    { label: t("granted"), value: figures.credits_granted },
    { label: t("used"), value: figures.credits_used },
    { label: t("remaining"), value: figures.credits_remaining },
    { label: t("waiting"), value: figures.waiting_for_deletion },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <NewAccountDialog creditsRemaining={figures.credits_remaining} />
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("counter")}>
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{tile.value}</dd>
          </Card>
        ))}
      </dl>
      <Table>
        <thead>
          <tr>
            <Th>{t("name")}</Th>
            <Th>{t("email")}</Th>
            <Th>{t("role")}</Th>
            <Th>{t("status")}</Th>
            <Th>{t("lastSignIn")}</Th>
            <Th className="text-right">
              <span className="sr-only">{t("actions")}</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {(accounts.data ?? []).map((account) => {
            const state = account.deletion_requested_at ? "waitingDeletion" : account.status === "suspended" ? "suspended" : account.joined_at ? "active" : "invited";
            const tone = { active: "success", invited: "info", suspended: "warning", waitingDeletion: "danger" } as const;
            return (
              <tr key={account.user_id}>
                <Td className="font-medium">{account.display_name}</Td>
                <Td className="text-muted">{account.email}</Td>
                <Td>{roles(account.role)}</Td>
                <Td>
                  <Badge tone={tone[state]}>{t(`state.${state}`)}</Badge>
                </Td>
                <Td className="text-muted">
                  {account.last_sign_in_at ? format.dateTime(new Date(account.last_sign_in_at), { dateStyle: "medium" }) : t("never")}
                </Td>
                <Td className="text-right">
                  <AccountActions
                    userId={account.user_id}
                    name={account.display_name}
                    role={account.role}
                    status={account.status}
                    invited={!account.joined_at}
                    deletionRequested={Boolean(account.deletion_requested_at)}
                    isSelf={account.user_id === viewer.userId}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
