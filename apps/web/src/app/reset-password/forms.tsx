"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { requestReset, setNewPassword } from "./actions";

export function RequestResetForm() {
  const t = useTranslations("Reset");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(requestReset, null);
  if (state?.ok) return <Alert tone="success">{t("sent")}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("email")} htmlFor="reset-email">
        <Input id="reset-email" name="email" type="email" autoComplete="email" required />
      </Field>
      {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}

export function NewPasswordForm({ minPassword }: { minPassword: number }) {
  const t = useTranslations("Reset");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(setNewPassword, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("newPassword")} hint={t("passwordRule", { min: minPassword })} htmlFor="reset-password">
        <Input id="reset-password" name="password" type="password" autoComplete="new-password" minLength={minPassword} required />
      </Field>
      <Field label={t("confirm")} htmlFor="reset-confirm">
        <Input id="reset-confirm" name="confirm" type="password" autoComplete="new-password" minLength={minPassword} required />
      </Field>
      {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
