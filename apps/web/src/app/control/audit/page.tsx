import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIONS = ["organization_created", "first_admin_invited", "credits_changed", "organization_renamed", "deletions_validated"] as const;

/** SCR-202: append-only log of operator actions (CT-040, CT-041). */
export default async function AuditPage() {
  const t = await getTranslations("Control");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const [entries, organizations] = await Promise.all([
    supabase.schema("licensing").from("operator_audit").select("id, at, action, organization_id, details").order("at", { ascending: false }).limit(200),
    supabase.schema("licensing").rpc("organization_figures"),
  ]);
  const names = new Map((organizations.data ?? []).map((row) => [row.id, row.name]));
  const describe = (action: string, details: unknown) => {
    const d = (details ?? {}) as Record<string, string | number>;
    if (!(ACTIONS as readonly string[]).includes(action)) return action;
    return t(`audit.${action as (typeof ACTIONS)[number]}`, {
      before: String(d.before ?? ""),
      after: String(d.after ?? ""),
      credits: String(d.credits_granted ?? ""),
      count: Number(d.accounts_removed ?? 0),
    });
  };
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("auditTitle")}</h1>
        <p className="text-sm text-muted">{t("auditSubtitle")}</p>
      </div>
      {entries.data && entries.data.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("when")}</Th>
              <Th>{t("organization")}</Th>
              <Th>{t("action")}</Th>
            </tr>
          </thead>
          <tbody>
            {entries.data.map((entry) => (
              <tr key={entry.id}>
                <Td className="whitespace-nowrap text-muted">{format.dateTime(new Date(entry.at), { dateStyle: "medium", timeStyle: "short" })}</Td>
                <Td>{entry.organization_id ? (names.get(entry.organization_id) ?? t("removedOrganization")) : null}</Td>
                <Td>{describe(entry.action, entry.details)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Card className="text-center">
          <p className="font-semibold">{t("auditEmpty")}</p>
        </Card>
      )}
    </div>
  );
}
