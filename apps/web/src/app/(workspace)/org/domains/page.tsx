import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { getViewer } from "@/lib/session";
import { getDomains } from "@/lib/spec";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DomainActions } from "./domain-actions";
import { DomainDialog, type Person } from "./domain-dialog";

/** SCR-081: the organization's business processes, shared by all projects (ADM-050…ADM-054). */
export default async function DomainsPage() {
  const t = await getTranslations("Domains");
  const viewer = await getViewer();
  const isAdmin = viewer?.account?.role === "admin";
  const supabase = await createSupabaseServerClient();
  const [domains, { data: accounts }] = await Promise.all([
    getDomains(),
    supabase.schema("app").from("memberships").select("email, display_name").eq("status", "active").order("display_name"),
  ]);
  const people: Person[] = (accounts ?? []).map((account) => ({ email: account.email, name: account.display_name }));
  const nameOf = (email: string) => people.find((person) => person.email === email)?.name ?? email;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="max-w-2xl text-sm text-muted">{t("subtitle")}</p>
        </div>
        {isAdmin ? <DomainDialog people={people} trigger={<Button>{t("new")}</Button>} /> : null}
      </div>
      {domains.length === 0 ? (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("emptyTitle")}</CardTitle>
          <p className="text-sm text-muted">{isAdmin ? t("emptyBody") : t("emptyViewer")}</p>
        </Card>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("code")}</Th>
              <Th>{t("name")}</Th>
              <Th>{t("owner")}</Th>
              <Th>{t("stewards")}</Th>
              <Th>{t("status")}</Th>
              {isAdmin ? (
                <Th className="text-right">
                  <span className="sr-only">{t("actions")}</span>
                </Th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <tr key={domain.code}>
                <Td className="font-mono font-bold">{domain.code}</Td>
                <Td>
                  <p className="font-medium">{domain.name}</p>
                  {domain.description ? <p className="text-xs text-muted">{domain.description}</p> : null}
                </Td>
                <Td>{nameOf(domain.ownerEmail)}</Td>
                <Td>{domain.stewardEmails.map(nameOf).join(", ")}</Td>
                <Td>{domain.retiredAt ? <Badge>{t("retired")}</Badge> : <Badge tone="success">{t("active")}</Badge>}</Td>
                {isAdmin ? (
                  <Td className="text-right">
                    <div className="flex items-start justify-end gap-1">
                      <DomainDialog people={people} domain={domain} trigger={<Button variant="ghost" size="sm" aria-label={t("editCode", { code: domain.code })}>{t("edit")}</Button>} />
                      <DomainActions code={domain.code} retired={Boolean(domain.retiredAt)} />
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
