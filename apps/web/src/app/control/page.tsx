import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewOrganizationDialog } from "./new-organization-dialog";

/** SCR-200: figures only, never a project, a user or any content (CT-010). */
export default async function ControlOrganizationsPage() {
  const t = await getTranslations("Control");
  const format = await getFormatter();
  const supabase = await createSupabaseServerClient();
  const { data: organizations } = await supabase.schema("licensing").rpc("organization_figures");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>
        <NewOrganizationDialog />
      </div>
      {organizations && organizations.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>{t("name")}</Th>
              <Th className="text-right">{t("credits")}</Th>
              <Th className="text-right">{t("accounts")}</Th>
              <Th className="text-right">{t("remaining")}</Th>
              <Th className="text-right">{t("deletionsWaiting")}</Th>
              <Th>{t("createdOn")}</Th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => (
              <tr key={organization.id}>
                <Td>
                  <Link href={`/control/o/${organization.id}`} className="font-medium text-control hover:underline">
                    {organization.name}
                  </Link>
                </Td>
                <Td className="text-right tabular-nums">{organization.credits_granted}</Td>
                <Td className="text-right tabular-nums">{organization.accounts}</Td>
                <Td className="text-right tabular-nums">{organization.credits_remaining}</Td>
                <Td className={`text-right tabular-nums ${organization.deletions_waiting > 0 ? "font-bold text-danger" : ""}`}>
                  {organization.deletions_waiting}
                </Td>
                <Td className="text-muted">{format.dateTime(new Date(organization.created_at), { dateStyle: "medium" })}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Card className="text-center">
          <p className="font-semibold">{t("empty")}</p>
        </Card>
      )}
    </div>
  );
}
