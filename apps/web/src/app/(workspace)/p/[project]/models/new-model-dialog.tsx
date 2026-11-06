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
import { createModel } from "./actions";

/** MAP-012 */
export function NewModelDialog({
  slug,
  domains,
  datasets,
}: {
  slug: string;
  domains: { code: string; name: string }[];
  datasets: { key: string; label: string }[];
}) {
  const t = useTranslations("Models");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(createModel.bind(null, slug), null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{t("new")}</Button>
      </DialogTrigger>
      <DialogContent title={t("new")} description={t("newHint")} closeLabel={t("close")}>
        {domains.length === 0 ? (
          <Alert tone="info">{t("noDomain")}</Alert>
        ) : (
          <ActionForm action={action} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("id")} hint={t("idHint")} htmlFor="model-id">
                <Input id="model-id" name="id" required pattern="[a-z0-9_\-]+" maxLength={100} autoFocus className="font-mono" />
              </Field>
              <Field label={t("name")} htmlFor="model-name">
                <Input id="model-name" name="name" required maxLength={120} />
              </Field>
            </div>
            <Field label={t("domain")} htmlFor="model-domain">
              <Select id="model-domain" name="domain" required>
                {domains.map((domain) => (
                  <option key={domain.code} value={domain.code}>
                    {t("domainOption", { code: domain.code, name: domain.name })}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("description")} hint={t("descriptionHint")} htmlFor="model-description">
              <Textarea id="model-description" name="description" required maxLength={2000} />
            </Field>
            <Field label={t("grain")} hint={t("grainHint")} htmlFor="model-grain">
              <Input id="model-grain" name="grain" required maxLength={500} />
            </Field>
            <Field label={t("from")} hint={t("fromHint")} htmlFor="model-from">
              <Select id="model-from" name="from" defaultValue="">
                <option value="">{t("fromEmpty")}</option>
                {datasets.map((dataset) => (
                  <option key={dataset.key} value={dataset.key}>
                    {dataset.label}
                  </option>
                ))}
              </Select>
            </Field>
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
