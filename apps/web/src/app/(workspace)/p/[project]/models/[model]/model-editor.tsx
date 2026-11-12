"use client";

import type { Severity } from "@atlas/core";
import { ArrowDown, ArrowUp, Redo2, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { type SaveState, useSpecDocument } from "@/components/spec/use-spec-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { CLASSIFICATIONS, LAYERS, MATERIALIZATIONS, type ModelContent, normalizeModel, type TargetColumn } from "@/lib/model";
import type { SqlPreview } from "@/lib/preview";
import { YamlView } from "@/components/spec/yaml-view";
import { SqlTab } from "./sql-tab";
import { cn } from "@/lib/utils";
import { saveModel } from "../actions";
import { BranchesTab, openBranches, type SourceOption } from "./branches-tab";
import { MappingsTab } from "./mappings-tab";
import { ChecksTab } from "./checks-tab";
import { ConsolidationTab } from "./consolidation-tab";
import type { Catalogue } from "@/components/spec/step-list";

export interface IssueView {
  code: string;
  severity: Severity;
  at: string;
  message: string;
}

const TABS = ["overview", "columns", "branches", "mappings", "consolidation", "checks", "yaml", "sql"] as const;
type Tab = (typeof TABS)[number];

const tone = (severity: Severity) => (severity === "error" ? "danger" : severity === "warning" ? "warning" : "info");

function moveKey<T>(record: Record<string, T>, index: number, by: number): Record<string, T> {
  const entries = Object.entries(record);
  const [entry] = entries.splice(index, 1);
  if (entry) entries.splice(index + by, 0, entry);
  return Object.fromEntries(entries);
}

/** SCR-021, first tabs: overview and target columns (MAP-020, MAP-021), saved automatically (MAP-070). */
export function ModelEditor({
  slug,
  initial,
  domains,
  sources,
  catalogue,
  stepTypes,
  canEdit,
  issues,
  sqlPreview,
  modelPath,
}: {
  slug: string;
  initial: ModelContent;
  domains: { code: string; name: string; retired: boolean }[];
  sources: SourceOption[];
  catalogue: Catalogue;
  stepTypes: Record<string, string>;
  canEdit: boolean;
  issues: IssueView[];
  sqlPreview: SqlPreview | null;
  modelPath: string;
}) {
  const t = useTranslations("ModelEditor");
  const router = useRouter();
  const save = useCallback(
    async (doc: ModelContent) => {
      const result = await saveModel(slug, doc);
      if (result?.ok) router.refresh();
      return Boolean(result?.ok);
    },
    [slug, router],
  );
  const [opened] = useState(() => ({ ...initial, branches: openBranches(initial.branches) }));
  const { doc, change, undo, redo, canUndo, canRedo, state, retry } = useSpecDocument<ModelContent>(opened, save);
  const [tab, setTab] = useState<Tab>("overview");
  const stored = useMemo(() => normalizeModel(doc) as Record<string, unknown>, [doc]);
  const columns = Object.entries(doc.columns);
  const setField = (patch: Partial<ModelContent>) => change((current) => ({ ...current, ...patch }));
  /** Columns are changed by position: a rename may still be on its way when the next field is edited. */
  const setColumnAt = (index: number, patch: Partial<TargetColumn>) =>
    change((current) => ({
      ...current,
      columns: Object.fromEntries(Object.entries(current.columns).map(([key, column], position) => [key, position === index ? { ...column, ...patch } : column])),
    }));
  const renameAt = (index: number, to: string) =>
    change((current) => {
      const entries = Object.entries(current.columns);
      if (entries.some(([key], position) => key === to && position !== index)) return current;
      return { ...current, columns: Object.fromEntries(entries.map(([key, column], position) => [position === index ? to : key, column])) };
    });
  const issuesAt = (prefix: string) => issues.filter((issue) => issue.at === prefix || issue.at.startsWith(`${prefix}.`));
  const disabled = !canEdit;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{doc.name}</h1>
          <Badge>{doc.domain}</Badge>
          <span className="font-mono text-xs text-muted">{doc.id}</span>
        </div>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              <Button variant="ghost" size="icon" aria-label={t("undo")} disabled={!canUndo} onClick={undo}>
                <Undo2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" aria-label={t("redo")} disabled={!canRedo} onClick={redo}>
                <Redo2 className="h-4 w-4" aria-hidden />
              </Button>
              <SaveStatus state={state} onRetry={retry} />
            </>
          ) : (
            <Badge>{t("readOnly")}</Badge>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-line" aria-label={t("tabs")} role="tablist">
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={cn("-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted hover:text-ink", tab === item && "border-brand text-ink")}
          >
            {t(`tab.${item}`)}
          </button>
        ))}
      </nav>

      {issues.length > 0 ? (
        <details className="rounded-md border border-line bg-surface" open={issues.some((issue) => issue.severity === "error")}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold">{t("problemsCount", { count: issues.length })}</summary>
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto border-t border-line p-3" aria-label={t("problems")}>
            {issues.map((issue) => (
              <li key={issue.code + issue.at + issue.message} className="text-xs">
                <Badge tone={tone(issue.severity)}>{issue.code}</Badge> <span className="font-mono text-muted">{issue.at}</span> {issue.message}
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="text-sm text-muted">{t("noProblem")}</p>
      )}

      <div className="min-w-0">
          {tab === "overview" ? (
            <Card className="grid gap-4 sm:grid-cols-2">
              <Field label={t("name")} htmlFor="m-name">
                <Input id="m-name" value={doc.name} disabled={disabled} onChange={(event) => setField({ name: event.target.value })} />
              </Field>
              <Field label={t("domain")} htmlFor="m-domain">
                <Select id="m-domain" value={doc.domain} disabled={disabled} onChange={(event) => setField({ domain: event.target.value })}>
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
                <Field label={t("description")} hint={t("descriptionHint")} htmlFor="m-description">
                  <Textarea id="m-description" value={doc.description} disabled={disabled} onChange={(event) => setField({ description: event.target.value })} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label={t("grain")} hint={t("grainHint", { keys: doc.grain.key.join(", ") || "—" })} htmlFor="m-grain">
                  <Input id="m-grain" value={doc.grain.description} disabled={disabled} onChange={(event) => setField({ grain: { ...doc.grain, description: event.target.value } })} />
                </Field>
              </div>
              <Field label={t("layer")} htmlFor="m-layer">
                <Select id="m-layer" value={String(doc.layer ?? "")} disabled={disabled} onChange={(event) => setField({ layer: event.target.value || undefined })}>
                  <option value="">{t("none")}</option>
                  {LAYERS.map((layer) => (
                    <option key={layer} value={layer}>
                      {t(`layers.${layer}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("materialization")} htmlFor="m-materialization">
                <Select id="m-materialization" value={String(doc.materialization ?? "")} disabled={disabled} onChange={(event) => setField({ materialization: event.target.value || undefined })}>
                  <option value="">{t("projectDefault")}</option>
                  {MATERIALIZATIONS.map((item) => (
                    <option key={item} value={item}>
                      {t(`materializations.${item}`)}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>
          ) : null}

          {tab === "columns" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t("columnsHint")}</p>
              <div className="relative w-full overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full min-w-[60rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted">
                      <th className="px-2 py-2 font-semibold">{t("column")}</th>
                      <th className="px-2 py-2 font-semibold">{t("definition")}</th>
                      <th className="px-2 py-2 font-semibold">{t("type")}</th>
                      <th className="px-2 py-2 text-center font-semibold">{t("nullable")}</th>
                      <th className="px-2 py-2 text-center font-semibold">{t("key")}</th>
                      <th className="px-2 py-2 font-semibold">{t("classification")}</th>
                      <th className="px-2 py-2">
                        <span className="sr-only">{t("actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map(([name, column], index) => (
                      <ColumnRow
                        key={index}
                        index={index}
                        name={name}
                        column={column}
                        disabled={disabled}
                        last={index === columns.length - 1}
                        taken={columns.some(([other], position) => other === name && position !== index)}
                        issues={issuesAt(`columns.${name}`)}
                        onRename={(to) => renameAt(index, to)}
                        onChange={(patch) => setColumnAt(index, patch)}
                        onMove={(by) => change((current) => ({ ...current, columns: moveKey(current.columns, index, by) }))}
                        onRemove={() => change((current) => ({ ...current, columns: Object.fromEntries(Object.entries(current.columns).filter((_, position) => position !== index)) }))}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {columns.length === 0 ? <p className="text-sm text-muted">{t("noColumn")}</p> : null}
              {canEdit ? (
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() =>
                    change((current) => {
                      let n = Object.keys(current.columns).length + 1;
                      while (`column_${n}` in current.columns) n += 1;
                      return { ...current, columns: { ...current.columns, [`column_${n}`]: { definition: "", type: "string", nullable: true, from: {} } } };
                    })
                  }
                >
                  {t("addColumn")}
                </Button>
              ) : null}
            </div>
          ) : null}

          {tab === "branches" ? <BranchesTab model={doc} change={change} sources={sources.filter((source) => source.key !== doc.id)} disabled={disabled} issues={issues} /> : null}

          {tab === "mappings" ? (
            <MappingsTab model={doc} change={change} sources={sources} catalogue={catalogue} stepTypes={stepTypes} issues={issues} disabled={disabled} />
          ) : null}

          {tab === "consolidation" ? <ConsolidationTab model={doc} change={change} rules={catalogue.rules.map((rule) => rule.id)} disabled={disabled} /> : null}

          {tab === "checks" ? (
            <ChecksTab
              model={doc}
              change={change}
              valueMappings={catalogue.valueMappings}
              references={sources.filter((source) => source.kind === "model").flatMap((source) => source.columns.map((column) => `${source.key}.${column.name}`))}
              disabled={disabled}
            />
          ) : null}

          {tab === "yaml" ? (
            <YamlView
              kind="model"
              value={stored}
              issues={issues}
              disabled={disabled}
              label={t("yamlOf", { name: doc.name })}
              onApply={(spec) => change(() => ({ ...(spec as ModelContent), branches: openBranches((spec as ModelContent).branches) }))}
            />
          ) : null}

          {tab === "sql" ? <SqlTab preview={sqlPreview} modelPath={modelPath} saving={state !== "saved"} /> : null}
      </div>
    </div>
  );
}

function ColumnRow({
  index,
  name,
  column,
  disabled,
  last,
  taken,
  issues,
  onRename,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  name: string;
  column: TargetColumn;
  disabled: boolean;
  last: boolean;
  taken: boolean;
  issues: IssueView[];
  onRename: (to: string) => void;
  onChange: (patch: Partial<TargetColumn>) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("ModelEditor");
  // A rename is applied when the field is left, so that typing does not rename on every key. The row is never
  // recreated (another field may be in use); its draft follows the name when it changes (move, undo).
  const [draft, setDraft] = useState(name);
  const [shown, setShown] = useState(name);
  if (shown !== name) {
    setShown(name);
    setDraft(name);
  }
  const n = index + 1;
  return (
    <tr className="border-t border-line/60 align-top">
      <td className="px-2 py-1.5">
        <Input
          aria-label={t("columnOf", { n })}
          value={draft}
          disabled={disabled}
          className="font-mono"
          onChange={(event) => setDraft(event.target.value.toLowerCase())}
          onBlur={() => (draft && draft !== name && /^[a-z0-9_-]+$/.test(draft) ? onRename(draft) : setDraft(name))}
        />
        {taken ? <p className="mt-1 text-xs text-danger">{t("duplicate")}</p> : null}
        {issues.map((issue) => (
          <p key={issue.code + issue.at + issue.message} className="mt-1 text-xs">
            <Badge tone={tone(issue.severity)}>{issue.code}</Badge> {issue.message}
          </p>
        ))}
      </td>
      <td className="px-2 py-1.5">
        <Input aria-label={t("definitionOf", { n })} value={column.definition} disabled={disabled} onChange={(event) => onChange({ definition: event.target.value })} />
      </td>
      <td className="w-40 px-2 py-1.5">
        <Input aria-label={t("typeOf", { n })} value={column.type} disabled={disabled} className="font-mono" onChange={(event) => onChange({ type: event.target.value })} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" className="mt-2.5" aria-label={t("nullableOf", { n })} checked={column.nullable} disabled={disabled} onChange={(event) => onChange({ nullable: event.target.checked })} />
      </td>
      <td className="px-2 py-1.5 text-center">
        <input type="checkbox" className="mt-2.5" aria-label={t("keyOf", { n })} checked={Boolean(column.key)} disabled={disabled} onChange={(event) => onChange({ key: event.target.checked || undefined, ...(event.target.checked ? { nullable: false } : {}) })} />
      </td>
      <td className="w-36 px-2 py-1.5">
        <Select aria-label={t("classificationOf", { n })} value={column.classification ?? ""} disabled={disabled} onChange={(event) => onChange({ classification: (event.target.value || undefined) as TargetColumn["classification"] })}>
          <option value="">{t("none")}</option>
          {CLASSIFICATIONS.map((item) => (
            <option key={item} value={item}>
              {t(`classifications.${item}`)}
            </option>
          ))}
        </Select>
      </td>
      <td className="whitespace-nowrap px-1 py-1.5">
        {!disabled ? (
          <>
            <Button variant="ghost" size="icon" aria-label={t("up", { n })} disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("down", { n })} disabled={last} onClick={() => onMove(1)}>
              <ArrowDown className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("remove", { n })} onClick={onRemove}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </>
        ) : null}
      </td>
    </tr>
  );
}

export function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const t = useTranslations("ModelEditor");
  if (state === "error") {
    return (
      <span className="flex items-center gap-2 text-sm text-danger" role="status">
        {t("saveFailed")}
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </span>
    );
  }
  return (
    <span className="text-sm text-muted" role="status">
      {t(`state.${state}`)}
    </span>
  );
}
