"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createAccount } from "./actions";

/** ADM-010: new account, refused without a remaining credit. */
export function NewAccountDialog({ creditsRemaining }: { creditsRemaining: number }) {
  const t = useTranslations("Accounts");
  const roles = useTranslations("Roles");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (previous, formData) => {
    const result = await createAccount(previous, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);

  if (creditsRemaining < 1) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button disabled>{t("new")}</Button>
        <p className="text-xs text-muted">{t("noCreditHint")}</p>
      </div>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("new")}</Button>
      </DialogTrigger>
      <DialogContent title={t("newTitle")} description={t("newDescription")} closeLabel={t("close")}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <Field label={t("name")} htmlFor="account-name">
            <Input id="account-name" name="name" required maxLength={120} autoFocus />
          </Field>
          <Field label={t("email")} hint={t("emailHint")} htmlFor="account-email">
            <Input id="account-email" name="email" type="email" required maxLength={254} />
          </Field>
          <Field label={t("role")} htmlFor="account-role">
            <Select id="account-role" name="role" defaultValue="editor">
              <option value="admin">{roles("admin")}</option>
              <option value="editor">{roles("editor")}</option>
              <option value="viewer">{roles("viewer")}</option>
            </Select>
          </Field>
          {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
          <Button type="submit" disabled={pending} className="self-end">
            {pending ? t("inviting") : t("invite")}
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
