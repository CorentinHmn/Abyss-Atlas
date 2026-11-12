"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createNamedVersion } from "./actions";

/** VER-030: a named version of the whole project. */
export function NewNamedVersion({ slug }: { slug: string }) {
  const t = useTranslations("History");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (previous, formData) => {
    const result = await createNamedVersion(slug, previous, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("newNamed")}</Button>
      </DialogTrigger>
      <DialogContent title={t("newNamed")} description={t("newNamedHint")} closeLabel={t("close")}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <Field label={t("name")} htmlFor="n-name">
            <Input id="n-name" name="name" required maxLength={80} autoFocus />
          </Field>
          <Field label={t("description")} htmlFor="n-description">
            <Textarea id="n-description" name="description" maxLength={2000} />
          </Field>
          {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
          <Button type="submit" disabled={pending} className="self-end">
            {t("create")}
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
