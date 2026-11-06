"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { saveDomain } from "./actions";

export interface Person {
  email: string;
  name: string;
}

export interface DomainValues {
  code: string;
  name: string;
  description: string;
  ownerEmail: string;
  stewardEmails: string[];
}

/** ADM-050, ADM-053 */
export function DomainDialog({ people, domain, trigger }: { people: Person[]; domain?: DomainValues; trigger: ReactNode }) {
  const t = useTranslations("Domains");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (previous, formData) => {
    const result = await saveDomain(previous, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={domain ? t("editTitle", { code: domain.code }) : t("newTitle")} description={t("dialogHint")} closeLabel={t("close")}>
        <ActionForm action={action} className="flex flex-col gap-4">
          {domain ? <input type="hidden" name="code" value={domain.code} /> : null}
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label={t("code")} hint={t("codeHint")} htmlFor="domain-code">
              <Input id="domain-code" name={domain ? undefined : "code"} defaultValue={domain?.code} disabled={Boolean(domain)} required pattern="[A-Za-z0-9]{2,5}" maxLength={5} className="uppercase" autoFocus={!domain} />
            </Field>
            <Field label={t("name")} htmlFor="domain-name">
              <Input id="domain-name" name="name" defaultValue={domain?.name} required maxLength={120} />
            </Field>
          </div>
          <Field label={t("description")} htmlFor="domain-description">
            <Textarea id="domain-description" name="description" defaultValue={domain?.description} maxLength={2000} />
          </Field>
          <Field label={t("owner")} hint={t("ownerHint")} htmlFor="domain-owner">
            <Select id="domain-owner" name="owner" defaultValue={domain?.ownerEmail ?? people[0]?.email} required>
              {people.map((person) => (
                <option key={person.email} value={person.email}>
                  {t("person", { name: person.name, email: person.email })}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("stewards")}</legend>
            <p className="text-xs text-muted">{t("stewardsHint")}</p>
            {people.map((person) => (
              <label key={person.email} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="stewards" value={person.email} defaultChecked={domain?.stewardEmails.includes(person.email)} />
                {t("person", { name: person.name, email: person.email })}
              </label>
            ))}
          </fieldset>
          {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
          <Button type="submit" disabled={pending} className="self-end">
            {t("save")}
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
