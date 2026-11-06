"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createOrganization } from "./actions";

/** CT-011, CT-012 */
export function NewOrganizationDialog() {
  const t = useTranslations("Control");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(createOrganization, null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-control hover:bg-control/90">{t("new")}</Button>
      </DialogTrigger>
      <DialogContent title={t("newTitle")} description={t("newDescription")} closeLabel={t("close")}>
        <form action={action} className="flex flex-col gap-4">
          <Field label={t("name")} htmlFor="org-name">
            <Input id="org-name" name="name" required maxLength={120} autoFocus />
          </Field>
          <Field label={t("credits")} htmlFor="org-credits">
            <Input id="org-credits" name="credits" type="number" min={1} max={100000} defaultValue={5} required />
          </Field>
          <Field label={t("adminName")} htmlFor="org-admin-name">
            <Input id="org-admin-name" name="adminName" required maxLength={120} />
          </Field>
          <Field label={t("adminEmail")} hint={t("adminEmailHint")} htmlFor="org-admin-email">
            <Input id="org-admin-email" name="adminEmail" type="email" required maxLength={254} />
          </Field>
          {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
          <Button type="submit" disabled={pending} className="self-end bg-control hover:bg-control/90">
            {t("create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
