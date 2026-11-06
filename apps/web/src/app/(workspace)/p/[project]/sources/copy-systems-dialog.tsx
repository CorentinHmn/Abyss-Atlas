"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { copySystems } from "./actions";

export interface OtherProject {
  slug: string;
  name: string;
  systems: { id: string; name: string; datasets: number }[];
}

/** SRC-005: copies systems and their datasets from another project; the copies are then independent. */
export function CopySystemsDialog({ slug, projects, taken }: { slug: string; projects: OtherProject[]; taken: string[] }) {
  const t = useTranslations("Sources");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(projects[0]?.slug ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();
  const project = projects.find((item) => item.slug === source);
  if (projects.length === 0) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">{t("copy")}</Button>
      </DialogTrigger>
      <DialogContent title={t("copyTitle")} description={t("copyHint")} closeLabel={t("close")}>
        <Field label={t("copyFrom")} htmlFor="copy-source">
          <Select
            id="copy-source"
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setChosen([]);
            }}
          >
            {projects.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("copySystems")}</legend>
          {(project?.systems ?? []).length === 0 ? <p className="text-sm text-muted">{t("copyNone")}</p> : null}
          {(project?.systems ?? []).map((system) => {
            const exists = taken.includes(system.id);
            return (
              <label key={system.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={exists}
                  checked={chosen.includes(system.id)}
                  onChange={(event) => setChosen(event.target.checked ? [...chosen, system.id] : chosen.filter((id) => id !== system.id))}
                />
                <span className="font-medium">{system.name}</span>
                <span className="text-muted">{exists ? t("copyExists", { id: system.id }) : t("datasetCount", { count: system.datasets })}</span>
              </label>
            );
          })}
        </fieldset>
        {result && !result.ok ? <Alert>{errors(result.error)}</Alert> : null}
        <Button
          className="self-end"
          disabled={pending || chosen.length === 0}
          onClick={() =>
            startTransition(async () => {
              const outcome = await copySystems(slug, source, chosen);
              setResult(outcome);
              if (outcome?.ok) {
                setOpen(false);
                setChosen([]);
              }
            })
          }
        >
          {t("copyAction")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
