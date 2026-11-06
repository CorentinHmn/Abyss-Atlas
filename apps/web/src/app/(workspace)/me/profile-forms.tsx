"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useTranslations } from "next-intl";
import { useActionState, useTransition, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { changePassword, saveDisplayName, signOutOtherSessions } from "./actions";

function Result({ state }: { state: ActionResult }) {
  const t = useTranslations("Profile");
  const errors = useTranslations("Errors");
  if (!state) return null;
  return state.ok ? <Alert tone="success">{t(state.message ?? "saved")}</Alert> : <Alert>{errors(state.error)}</Alert>;
}

export function ProfileForms({ displayName, minPassword }: { displayName: string; minPassword: number }) {
  const t = useTranslations("Profile");
  const [nameState, nameAction, namePending] = useActionState<ActionResult, FormData>(saveDisplayName, null);
  const [passwordState, passwordAction, passwordPending] = useActionState<ActionResult, FormData>(changePassword, null);
  const [sessionsState, setSessionsState] = useState<ActionResult>(null);
  const [sessionsPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <ActionForm action={nameAction} className="flex flex-col gap-4">
          <CardTitle>{t("nameTitle")}</CardTitle>
          <Field label={t("name")} htmlFor="profile-name">
            <Input id="profile-name" name="name" defaultValue={displayName} required maxLength={120} />
          </Field>
          <Result state={nameState} />
          <Button type="submit" disabled={namePending} className="self-start">
            {t("save")}
          </Button>
        </ActionForm>
      </Card>
      <Card>
        <ActionForm action={passwordAction} className="flex flex-col gap-4">
          <CardTitle>{t("passwordTitle")}</CardTitle>
          <Field label={t("newPassword")} hint={t("passwordRule", { min: minPassword })} htmlFor="profile-password">
            <Input id="profile-password" name="password" type="password" autoComplete="new-password" minLength={minPassword} required />
          </Field>
          <Field label={t("confirmPassword")} htmlFor="profile-confirm">
            <Input id="profile-confirm" name="confirm" type="password" autoComplete="new-password" minLength={minPassword} required />
          </Field>
          <Result state={passwordState} />
          <Button type="submit" disabled={passwordPending} className="self-start">
            {t("changePassword")}
          </Button>
        </ActionForm>
      </Card>
      <Card className="flex flex-col gap-3">
        <CardTitle>{t("sessionsTitle")}</CardTitle>
        <p className="text-sm text-muted">{t("sessionsBody")}</p>
        <Result state={sessionsState} />
        <Button
          variant="secondary"
          className="self-start"
          disabled={sessionsPending}
          onClick={() => startTransition(async () => setSessionsState(await signOutOtherSessions()))}
        >
          {t("signOutOthers")}
        </Button>
      </Card>
    </div>
  );
}
