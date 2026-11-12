"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { type Catalogue, StepList } from "@/components/spec/step-list";
import { useSpecDocument } from "@/components/spec/use-spec-document";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { Step } from "@/lib/mappings";
import type { RuleContent } from "@/lib/reusable";
import { EditorHeader, type IssueView, Problems, type UseView, WhereUsed } from "../../reusable-shared";
import { saveReusable } from "../../spec-actions";

/** SCR-040, MAP-050, MAP-051: a business rule, its parameters and its logic, saved automatically. */
export function RuleEditor({
  slug,
  initial,
  domains,
  catalogue,
  stepTypes,
  issues,
  uses,
  canEdit,
}: {
  slug: string;
  initial: RuleContent;
  domains: { code: string; name: string; retired: boolean }[];
  catalogue: Catalogue;
  stepTypes: Record<string, string>;
  issues: IssueView[];
  uses: UseView[];
  canEdit: boolean;
}) {
  const t = useTranslations("Reusable");
  const router = useRouter();
  const save = useCallback(
    async (doc: RuleContent) => {
      const result = await saveReusable(slug, "rule", doc);
      if (result?.ok) router.refresh();
      return Boolean(result?.ok);
    },
    [slug, router],
  );
  const { doc, change, undo, redo, canUndo, canRedo, state, retry } = useSpecDocument<RuleContent>(initial, save);
  const disabled = !canEdit;
  const set = (patch: Partial<RuleContent>) => change((current) => ({ ...current, ...patch }));
  const parameters = Object.entries(doc.parameters);
  /** Parameters are changed by position, like target columns: a rename may still be on its way. */
  const setParameterAt = (index: number, name: string, type: string) =>
    change((current) => {
      const entries = Object.entries(current.parameters);
      if (entries.some(([key], position) => key === name && position !== index)) return current;
      return { ...current, parameters: Object.fromEntries(entries.map((entry, position) => (position === index ? [name, type] : entry))) };
    });
  const addParameter = () =>
    change((current) => {
      let n = Object.keys(current.parameters).length + 1;
      while (`param_${n}` in current.parameters) n += 1;
      return { ...current, parameters: { ...current.parameters, [`param_${n}`]: "string" } };
    });
  const removeParameterAt = (index: number) =>
    change((current) => ({ ...current, parameters: Object.fromEntries(Object.entries(current.parameters).filter((_, position) => position !== index)) }));

  return (
    <div className="flex flex-col gap-4">
      <EditorHeader name={doc.name} domain={doc.domain} id={doc.id} canEdit={canEdit} canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} state={state} retry={retry} />
      <Problems issues={issues} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="r-name">
              <Input id="r-name" value={doc.name} disabled={disabled} onChange={(event) => set({ name: event.target.value })} />
            </Field>
            <Field label={t("domain")} htmlFor="r-domain">
              <Select id="r-domain" value={doc.domain} disabled={disabled} onChange={(event) => set({ domain: event.target.value })}>
                {domains
                  .filter((domain) => !domain.retired || domain.code === doc.domain)
                  .map((domain) => (
                    <option key={domain.code} value={domain.code}>
                      {t("domainOption", { code: domain.code, name: domain.name })}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t("statement")} hint={t("statementHint")} htmlFor="r-statement">
                <Textarea id="r-statement" value={doc.statement} disabled={disabled} onChange={(event) => set({ statement: event.target.value })} />
              </Field>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">{t("parameters")}</h2>
            <p className="text-xs text-muted">{t("parametersHint")}</p>
            <ul className="flex flex-col gap-2" aria-label={t("parameters")}>
              {parameters.map(([name, type], index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={t("parameterName", { n: index + 1 })}
                    className="w-48 font-mono"
                    value={name}
                    disabled={disabled}
                    onChange={(event) => setParameterAt(index, event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"), type)}
                  />
                  <Input aria-label={t("parameterType", { n: index + 1 })} className="w-40 font-mono" value={type} disabled={disabled} onChange={(event) => setParameterAt(index, name, event.target.value)} />
                  {!disabled ? (
                    <Button variant="ghost" size="icon" aria-label={t("removeParameter", { name })} onClick={() => removeParameterAt(index)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {!disabled ? (
              <Button variant="secondary" size="sm" className="self-start" onClick={addParameter}>
                {t("addParameter")}
              </Button>
            ) : null}
            <Field label={t("returns")} htmlFor="r-returns">
              <Input id="r-returns" className="w-48 font-mono" value={doc.returns} disabled={disabled} onChange={(event) => set({ returns: event.target.value })} />
            </Field>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-sm font-bold">{t("logic")}</h2>
            <p className="text-xs text-muted">{t("logicHint")}</p>
            <StepList
              steps={doc.logic as Step[]}
              columns={[]}
              params={parameters.map(([name]) => name)}
              catalogue={catalogue}
              types={doc.logic.map((_, index) => stepTypes[`logic[${index}]`])}
              disabled={disabled}
              label={t("logic")}
              onChange={(logic) => set({ logic })}
            />
          </Card>
        </div>
        <WhereUsed uses={uses} />
      </div>
    </div>
  );
}
