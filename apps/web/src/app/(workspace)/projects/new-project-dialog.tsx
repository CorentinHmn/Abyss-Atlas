"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createProject } from "./actions";

export function NewProjectDialog() {
  const t = useTranslations("Projects");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(async (previous, formData) => {
    const result = await createProject(previous, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("new")}</Button>
      </DialogTrigger>
      <DialogContent title={t("newTitle")} closeLabel={t("close")}>
        <form action={action} className="flex flex-col gap-4">
          <Field label={t("name")} htmlFor="project-name">
            <Input id="project-name" name="name" required maxLength={120} autoFocus />
          </Field>
          <Field label={t("description")} hint={t("descriptionHint")} htmlFor="project-description">
            <Textarea id="project-description" name="description" maxLength={500} />
          </Field>
          {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
          <Button type="submit" disabled={pending} className="self-end">
            {t("create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
