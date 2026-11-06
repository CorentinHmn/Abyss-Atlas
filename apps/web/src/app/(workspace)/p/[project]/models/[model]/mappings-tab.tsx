"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { type Catalogue, StepList } from "@/components/spec/step-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TokenInput } from "@/components/ui/token-input";
import type { SourceColumn } from "@/lib/conditions";
import { ALL, type MappingDraft, type Mode, openMapping, referencedColumns, storeMapping, summarize } from "@/lib/mappings";
import type { ModelContent, TargetColumn } from "@/lib/model";
import { cn } from "@/lib/utils";
import { type Branch, branchColumns, type SourceOption } from "./branches-tab";
import type { IssueView } from "./model-editor";

const tone = (severity: string) => (severity === "error" ? "danger" : severity === "warning" ? "warning" : "info");

/** MAP-023, MAP-040…MAP-046: the mapping matrix and the panel of one target column. */
export function MappingsTab({
  model,
  change,
  sources,
  catalogue,
  stepTypes,
  issues,
  disabled,
}: {
  model: ModelContent;
  change: (update: (current: ModelContent) => ModelContent) => void;
  sources: SourceOption[];
  catalogue: Catalogue;
  stepTypes: Record<string, string>;
  issues: IssueView[];
  disabled: boolean;
}) {
  const t = useTranslations("Mappings");
  const branches = model.branches as Record<string, Branch>;
  const branchIds = Object.keys(branches);
  const columns = Object.entries(model.columns);
  const [selected, setSelected] = useState<string | null>(columns[0]?.[0] ?? null);
  const columnIssues = (column: string, key?: string) =>
    issues.filter((issue) => {
      const prefix = key ? `columns.${column}.from.${key}` : `columns.${column}`;
      return issue.at === prefix || issue.at.startsWith(`${prefix}.`) || issue.at.startsWith(`${prefix}[`);
    });

  const setFrom = (column: string, update: (from: Record<string, unknown>) => Record<string, unknown>) =>
    change((current) => {
      const target = current.columns[column];
      if (!target) return current;
      return { ...current, columns: { ...current.columns, [column]: { ...target, from: update(target.from) } as TargetColumn } };
    });

  if (branchIds.length === 0) return <p className="text-sm text-muted">{t("noBranch")}</p>;
  if (columns.length === 0) return <p className="text-sm text-muted">{t("noColumn")}</p>;

  const index = columns.findIndex(([name]) => name === selected);
  const current = index >= 0 ? columns[index] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro")}</p>
      <div className="relative w-full overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm" aria-label={t("matrix")}>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="sticky left-0 bg-surface px-3 py-2 font-semibold">{t("column")}</th>
              {branchIds.map((id) => (
                <th key={id} className="px-3 py-2 font-semibold">
                  {branches[id]?.label || id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map(([name, column]) => (
              <tr key={name} className={cn("border-t border-line/60", name === selected && "bg-brand/5")}>
                <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-mono text-xs font-semibold">
                  {name}
                  <span className="block font-sans font-normal text-muted">{column.type}</span>
                </th>
                {branchIds.map((id) => {
                  const shared = ALL in column.from;
                  const raw = shared ? column.from[ALL] : column.from[id];
                  const summary = summarize(raw);
                  const problems = columnIssues(name, shared ? ALL : id);
                  const errorCount = problems.filter((issue) => issue.severity === "error").length;
                  return (
                    <td key={id} className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => setSelected(name)}
                        aria-label={t("cellOf", { column: name, branch: id })}
                        className={cn(
                          "flex w-full min-w-44 max-w-72 items-center gap-1 rounded border px-2 py-1.5 text-left text-xs hover:border-brand",
                          summary.kind === "empty" ? "border-dashed border-warning/60 text-warning" : "border-line",
                          errorCount > 0 && "border-danger/60",
                        )}
                      >
                        {shared ? <Badge className="shrink-0">{t("all")}</Badge> : null}
                        {summary.unstructured ? <Badge tone="warning" className="shrink-0">{t("sql")}</Badge> : null}
                        <span className={cn("truncate font-mono", summary.kind === "not_provided" && "font-sans italic text-muted")}>
                          {summary.kind === "empty" ? t("empty") : summary.kind === "not_provided" ? t("notProvidedShort", { reason: summary.text }) : summary.text}
                        </span>
                        {errorCount > 0 ? <Badge tone="danger" className="ml-auto shrink-0">{errorCount}</Badge> : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current ? (
        <ColumnPanel
          key={current[0]}
          name={current[0]}
          column={current[1]}
          branches={branches}
          sources={sources}
          catalogue={catalogue}
          stepTypes={stepTypes}
          issuesOf={(key) => columnIssues(current[0], key)}
          disabled={disabled}
          onPrevious={index > 0 ? () => setSelected(columns[index - 1]?.[0] ?? null) : undefined}
          onNext={index < columns.length - 1 ? () => setSelected(columns[index + 1]?.[0] ?? null) : undefined}
          setFrom={(update) => setFrom(current[0], update)}
        />
      ) : null}
    </div>
  );
}

function ColumnPanel({
  name,
  column,
  branches,
  sources,
  catalogue,
  stepTypes,
  issuesOf,
  disabled,
  onPrevious,
  onNext,
  setFrom,
}: {
  name: string;
  column: TargetColumn;
  branches: Record<string, Branch>;
  sources: SourceOption[];
  catalogue: Catalogue;
  stepTypes: Record<string, string>;
  issuesOf: (key: string) => IssueView[];
  disabled: boolean;
  onPrevious: (() => void) | undefined;
  onNext: (() => void) | undefined;
  setFrom: (update: (from: Record<string, unknown>) => Record<string, unknown>) => void;
}) {
  const t = useTranslations("Mappings");
  const branchIds = Object.keys(branches);
  const shared = ALL in column.from;
  const keys = shared ? [ALL] : branchIds;
  const columnsOf = (key: string): SourceColumn[] => branchColumns(branches[key === ALL ? (branchIds[0] ?? "") : key] ?? { datasets: [] }, sources);

  const setMapping = (key: string, draft: MappingDraft) =>
    setFrom((from) => {
      const stored = storeMapping(draft);
      const next = { ...from };
      if (stored === undefined) delete next[key];
      else next[key] = stored;
      return next;
    });

  /** One mapping for every branch (`*`), or one per branch: switching copies what exists. */
  const toggleShared = (on: boolean) =>
    setFrom((from) => {
      if (on) {
        const first = branchIds.map((id) => from[id]).find((value) => value !== undefined);
        return first === undefined ? {} : { [ALL]: first };
      }
      const value = from[ALL];
      return value === undefined ? {} : Object.fromEntries(branchIds.map((id) => [id, value]));
    });

  /** MAP-046: copies a branch's mapping into the other branches whose datasets have the same columns. */
  const copyToOthers = (key: string) =>
    setFrom((from) => {
      const value = from[key];
      if (value === undefined) return from;
      const needed = referencedColumns(value);
      const next = { ...from };
      for (const id of branchIds) {
        if (id === key) continue;
        const available = new Set(branchColumns(branches[id] ?? { datasets: [] }, sources).map((item) => item.ref));
        if (needed.every((ref) => available.has(ref))) next[id] = value;
      }
      return next;
    });

  return (
    <Card className="flex flex-col gap-4" aria-label={t("panelOf", { column: name })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-lg font-bold">{name}</h3>
          <p className="text-sm">{column.definition}</p>
          <p className="text-xs text-muted">{t("target", { type: column.type, nullable: column.nullable ? t("nullable") : t("required") })}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label={t("previous")} disabled={!onPrevious} onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={t("next")} disabled={!onNext} onClick={onNext}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
      {branchIds.length > 1 || shared ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={shared} disabled={disabled} onChange={(event) => toggleShared(event.target.checked)} />
          {t("shared")}
        </label>
      ) : null}
      <div className={cn("grid gap-4", keys.length > 1 && "xl:grid-cols-2")}>
        {keys.map((key) => (
          <MappingEditor
            key={key}
            branchLabel={key === ALL ? t("allBranches") : branches[key]?.label || key}
            branchKey={key}
            column={name}
            value={column.from[key]}
            columns={columnsOf(key)}
            catalogue={catalogue}
            types={(openMapping(column.from[key]).steps).map((_, index) => stepTypes[`columns.${name}.from.${key}.steps[${index}]`])}
            issues={issuesOf(key)}
            disabled={disabled}
            canCopy={!shared && branchIds.length > 1}
            onChange={(draft) => setMapping(key, draft)}
            onCopy={() => copyToOthers(key)}
          />
        ))}
      </div>
    </Card>
  );
}

function MappingEditor({
  branchLabel,
  branchKey,
  column,
  value,
  columns,
  catalogue,
  types,
  issues,
  disabled,
  canCopy,
  onChange,
  onCopy,
}: {
  branchLabel: string;
  branchKey: string;
  column: string;
  value: unknown;
  columns: SourceColumn[];
  catalogue: Catalogue;
  types: (string | undefined)[];
  issues: IssueView[];
  disabled: boolean;
  canCopy: boolean;
  onChange: (draft: MappingDraft) => void;
  onCopy: () => void;
}) {
  const t = useTranslations("Mappings");
  const list = useId();
  const draft = openMapping(value);
  const label = t("mappingOf", { column, branch: branchLabel });
  const set = (patch: Partial<MappingDraft>) => onChange({ ...draft, ...patch });
  const setMode = (mode: Mode) => {
    if (mode === "copy") set({ mode, inputs: draft.inputs.slice(0, 1), steps: [] });
    else set({ mode });
  };
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-md border border-line p-3" aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{branchLabel}</h4>
        <div className="flex flex-wrap items-center gap-2">
          {canCopy && draft.mode !== "empty" && !disabled ? (
            <Button variant="ghost" size="sm" onClick={onCopy}>
              {t("copyToOthers")}
            </Button>
          ) : null}
          <Select aria-label={t("modeOf", { label })} className="w-full sm:w-48" value={draft.mode} disabled={disabled} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="empty">{t("mode.empty")}</option>
            <option value="copy">{t("mode.copy")}</option>
            <option value="steps">{t("mode.steps")}</option>
            <option value="not_provided">{t("mode.not_provided")}</option>
          </Select>
        </div>
      </div>
      <datalist id={list}>
        {columns.map((item) => (
          <option key={item.ref} value={item.ref}>
            {item.type}
          </option>
        ))}
      </datalist>

      {draft.mode === "copy" ? (
        <Input aria-label={t("sourceOf", { label })} list={list} className="font-mono" placeholder="alias.COLUMN" value={draft.inputs[0] ?? ""} disabled={disabled} onChange={(event) => set({ inputs: [event.target.value] })} />
      ) : null}

      {draft.mode === "not_provided" ? (
        <Textarea aria-label={t("reasonOf", { label })} placeholder={t("reasonPlaceholder")} value={draft.reason} disabled={disabled} onChange={(event) => set({ reason: event.target.value })} />
      ) : null}

      {draft.mode === "steps" ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t("inputs")}</span>
            <TokenInput aria-label={t("inputsOf", { label })} list={list} className="font-mono" placeholder={t("inputsPlaceholder")} value={draft.inputs} disabled={disabled} onCommit={(inputs) => set({ inputs })} />
          </div>
          <StepList steps={draft.steps} columns={columns} catalogue={catalogue} types={types} disabled={disabled} label={label} onChange={(steps) => set({ steps })} />
          <Input aria-label={t("noteOf", { label })} placeholder={t("notePlaceholder")} value={draft.note} disabled={disabled} onChange={(event) => set({ note: event.target.value })} />
        </>
      ) : null}

      {issues.map((issue) => (
        <p key={issue.code + issue.at + issue.message} className="text-xs">
          <Badge tone={tone(issue.severity)}>{issue.code}</Badge> <span className="font-mono text-muted">{issue.at.replace(`columns.${column}.from.${branchKey}`, "") || "·"}</span> {issue.message}
        </p>
      ))}
    </section>
  );
}
