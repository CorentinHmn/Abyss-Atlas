import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CreditsForm, DeletionsCard, FirstAdminForm, RenameForm } from "./forms";

/** SCR-201 */
export default async function ControlOrganizationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { id } = await params;
  const inviteFailed = (await searchParams).invite === "failed";
  const t = await getTranslations("Control");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.schema("licensing").rpc("organization_figures");
  const organization = data?.find((row) => row.id === id);
  if (!organization) notFound();
  const tiles = [
    { label: t("credits"), value: organization.credits_granted },
    { label: t("accounts"), value: organization.accounts },
    { label: t("remaining"), value: organization.credits_remaining },
    { label: t("deletionsWaiting"), value: organization.deletions_waiting },
  ];
  return (
    <div className="flex flex-col gap-6">
      <Link href="/control" className="text-sm text-muted hover:text-ink">
        {t("back")}
      </Link>
      <h1 className="text-2xl font-bold">{organization.name}</h1>
      {inviteFailed ? <Alert>{t("inviteFailed")}</Alert> : null}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <dt className="text-xs text-muted">{tile.label}</dt>
            <dd className="text-2xl font-bold tabular-nums">{tile.value}</dd>
          </Card>
        ))}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        {organization.accounts === 0 ? <FirstAdminForm organizationId={id} /> : null}
        <DeletionsCard organizationId={id} waiting={organization.deletions_waiting} />
        <CreditsForm organizationId={id} credits={organization.credits_granted} accounts={organization.accounts} />
        <RenameForm organizationId={id} name={organization.name} />
      </div>
    </div>
  );
}
