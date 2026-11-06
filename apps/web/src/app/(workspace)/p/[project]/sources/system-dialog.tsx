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
import { SYSTEM_TYPES } from "@/lib/sources";
import { saveSystem } from "./actions";

export interface SystemValues {
  id: string;
  name: string;
  systemType: string;
  product: string;
  description: string;
  landingDatabase: string;
  landingSchema: string;
  namingPattern: string;
}

/** SRC-001, SRC-002: new system, or change of an existing one (its id stays). */
export function SystemDialog({ slug, system, trigger }: { slug: string; system?: SystemValues; trigger: ReactNode }) {
  const t = useTranslations("Sources");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (previous, formData) => {
    const result = await saveSystem(slug, previous, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={system ? t("editSystem") : t("newSystem")} description={t("systemHint")} closeLabel={t("close")}>
        <ActionForm action={action} className="flex flex-col gap-4">
          {system ? <input type="hidden" name="existingId" value={system.id} /> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("systemId")} hint={t("systemIdHint")} htmlFor="system-id">
              <Input id="system-id" name="id" defaultValue={system?.id} disabled={Boolean(system)} required pattern="[a-z0-9_\-]+" maxLength={100} autoFocus={!system} />
            </Field>
            <Field label={t("systemName")} htmlFor="system-name">
              <Input id="system-name" name="name" defaultValue={system?.name} required maxLength={120} />
            </Field>
            <Field label={t("systemType")} htmlFor="system-type">
              <Select id="system-type" name="systemType" defaultValue={system?.systemType ?? "erp"}>
                {SYSTEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`systemTypes.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("product")} hint={t("productHint")} htmlFor="system-product">
              <Input id="system-product" name="product" defaultValue={system?.product} maxLength={120} />
            </Field>
          </div>
          <Field label={t("description")} htmlFor="system-description">
            <Textarea id="system-description" name="description" defaultValue={system?.description} maxLength={2000} />
          </Field>
          <fieldset className="flex flex-col gap-3 rounded-md border border-line p-3">
            <legend className="px-1 text-sm font-semibold">{t("landing")}</legend>
            <p className="text-xs text-muted">{t("landingHint")}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={t("landingDatabase")} htmlFor="landing-database">
                <Input id="landing-database" name="landingDatabase" defaultValue={system?.landingDatabase} maxLength={120} />
              </Field>
              <Field label={t("landingSchema")} htmlFor="landing-schema">
                <Input id="landing-schema" name="landingSchema" defaultValue={system?.landingSchema} maxLength={120} />
              </Field>
              <Field label={t("namingPattern")} htmlFor="naming-pattern">
                <Input id="naming-pattern" name="namingPattern" defaultValue={system?.namingPattern} maxLength={120} />
              </Field>
            </div>
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
