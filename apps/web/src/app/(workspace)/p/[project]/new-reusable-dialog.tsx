"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createReusable } from "./spec-actions";

/** MAP-050, MAP-052: a new business rule or value mapping. */
export function NewReusableDialog({ slug, kind, domains }: { slug: string; kind: "rule" | "value_mapping"; domains: { code: string; name: string }[] }) {
  const t = useTranslations("Reusable");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(createReusable.bind(null, slug, kind), null);
  const title = kind === "rule" ? t("newRule") : t("newMapping");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{title}</Button>
      </DialogTrigger>
      <DialogContent title={title} description={kind === "rule" ? t("newRuleHint") : t("newMappingHint")} closeLabel={t("close")}>
        {domains.length === 0 ? (
          <Alert tone="info">{t("noDomain")}</Alert>
        ) : (
          <ActionForm action={action} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("id")} hint={t("idHint")} htmlFor="r-id">
                <Input id="r-id" name="id" required pattern="[a-z0-9_\-]+" maxLength={100} className="font-mono" autoFocus />
              </Field>
              <Field label={t("name")} htmlFor="r-name">
                <Input id="r-name" name="name" required maxLength={120} />
              </Field>
            </div>
            <Field label={t("domain")} htmlFor="r-domain">
              <Select id="r-domain" name="domain" required>
                {domains.map((domain) => (
                  <option key={domain.code} value={domain.code}>
                    {t("domainOption", { code: domain.code, name: domain.name })}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === "rule" ? (
              <>
                <Field label={t("statement")} hint={t("statementHint")} htmlFor="r-statement">
                  <Textarea id="r-statement" name="statement" required maxLength={2000} />
                </Field>
                <Field label={t("returns")} htmlFor="r-returns">
                  <Input id="r-returns" name="returns" defaultValue="string" className="font-mono" maxLength={60} />
                </Field>
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fromType")} htmlFor="r-from">
                  <Input id="r-from" name="fromType" defaultValue="string" className="font-mono" maxLength={60} />
                </Field>
                <Field label={t("toType")} htmlFor="r-to">
                  <Input id="r-to" name="toType" defaultValue="string" className="font-mono" maxLength={60} />
                </Field>
              </div>
            )}
            {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
            <Button type="submit" disabled={pending} className="self-end">
              {t("create")}
            </Button>
          </ActionForm>
        )}
      </DialogContent>
    </Dialog>
  );
}
