"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { inviteFirstAdmin, renameOrganization, setCredits, validateDeletions } from "../../actions";

function Result({ state }: { state: ActionResult }) {
  const t = useTranslations("Control");
  const errors = useTranslations("Errors");
  if (!state) return null;
  return state.ok ? (state.message ? <Alert tone="success">{t(state.message)}</Alert> : null) : <Alert>{errors(state.error)}</Alert>;
}

export function CreditsForm({ organizationId, credits, accounts }: { organizationId: string; credits: number; accounts: number }) {
  const t = useTranslations("Control");
  const [state, action, pending] = useActionState<ActionResult, FormData>(setCredits, null);
  return (
    <Card>
      <ActionForm action={action} className="flex flex-col gap-3">
        <CardTitle>{t("creditsTitle")}</CardTitle>
        <input type="hidden" name="organization" value={organizationId} />
        <Field label={t("credits")} hint={t("creditsHint", { accounts })} htmlFor="credits">
          <Input id="credits" name="credits" type="number" min={accounts} max={100000} defaultValue={credits} required className="max-w-32" />
        </Field>
        <Result state={state} />
        <Button type="submit" disabled={pending} className="self-start bg-control hover:bg-control/90">
          {t("save")}
        </Button>
      </ActionForm>
    </Card>
  );
}

export function RenameForm({ organizationId, name }: { organizationId: string; name: string }) {
  const t = useTranslations("Control");
  const [state, action, pending] = useActionState<ActionResult, FormData>(renameOrganization, null);
  return (
    <Card>
      <ActionForm action={action} className="flex flex-col gap-3">
        <CardTitle>{t("renameTitle")}</CardTitle>
        <input type="hidden" name="organization" value={organizationId} />
        <Field label={t("name")} htmlFor="name">
          <Input id="name" name="name" defaultValue={name} required maxLength={120} />
        </Field>
        <Result state={state} />
        <Button type="submit" disabled={pending} className="self-start bg-control hover:bg-control/90">
          {t("save")}
        </Button>
      </ActionForm>
    </Card>
  );
}

/** CT-020, CT-021: a number only, validated in one action. */
export function DeletionsCard({ organizationId, waiting }: { organizationId: string; waiting: number }) {
  const t = useTranslations("Control");
  const [state, setState] = useState<ActionResult>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t("deletionsTitle")}</CardTitle>
      <p className="text-sm">{t("deletionsCount", { count: waiting })}</p>
      <p className="text-xs text-muted">{t("deletionsHint")}</p>
      <Result state={state} />
      {waiting > 0 ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="self-start bg-control hover:bg-control/90">{t("validate")}</Button>
          </DialogTrigger>
          <DialogContent title={t("validateTitle", { count: waiting })} description={t("validateBody")} closeLabel={t("close")}>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="secondary">{t("cancel")}</Button>
              </DialogClose>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setState(await validateDeletions(organizationId));
                    setOpen(false);
                  })
                }
              >
                {t("validate")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}

export function FirstAdminForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations("Control");
  const [state, action, pending] = useActionState<ActionResult, FormData>(inviteFirstAdmin, null);
  return (
    <Card>
      <ActionForm action={action} className="flex flex-col gap-3">
        <CardTitle>{t("firstAdminTitle")}</CardTitle>
        <p className="text-sm text-muted">{t("firstAdminBody")}</p>
        <input type="hidden" name="organization" value={organizationId} />
        <Field label={t("adminName")} htmlFor="admin-name">
          <Input id="admin-name" name="adminName" required maxLength={120} />
        </Field>
        <Field label={t("adminEmail")} htmlFor="admin-email">
          <Input id="admin-email" name="adminEmail" type="email" required maxLength={254} />
        </Field>
        <Result state={state} />
        <Button type="submit" disabled={pending} className="self-start bg-control hover:bg-control/90">
          {t("invite")}
        </Button>
      </ActionForm>
    </Card>
  );
}
