"use client";

import { ActionForm } from "@/components/ui/action-form";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { DATASET_TYPES } from "@/lib/sources";
import { createDataset } from "./actions";

/** SRC-011 */
export function NewDatasetDialog({ slug, systemId }: { slug: string; systemId: string }) {
  const t = useTranslations("Sources");
  const errors = useTranslations("Errors");
  const [state, action, pending] = useActionState<ActionResult, FormData>(createDataset.bind(null, slug, systemId), null);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          {t("newDataset")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("newDataset")} description={t("newDatasetHint")} closeLabel={t("close")}>
        <ActionForm action={action} className="flex flex-col gap-4">
          <Field label={t("datasetName")} hint={t("datasetNameHint")} htmlFor="dataset-name">
            <Input id="dataset-name" name="name" required maxLength={120} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("datasetType")} htmlFor="dataset-type">
              <Select id="dataset-type" name="datasetType" defaultValue="table">
                {DATASET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`datasetTypes.${type}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("namespace")} htmlFor="dataset-namespace">
              <Input id="dataset-namespace" name="namespace" maxLength={120} />
            </Field>
          </div>
          <Field label={t("description")} htmlFor="dataset-description">
            <Textarea id="dataset-description" name="description" maxLength={2000} />
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
