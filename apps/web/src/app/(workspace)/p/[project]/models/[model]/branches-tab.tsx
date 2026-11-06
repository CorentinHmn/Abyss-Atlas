"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConditionEditor, OptionalCondition } from "@/components/spec/condition-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TokenInput } from "@/components/ui/token-input";
import { Field } from "@/components/ui/label";
import { type Comparison, type Condition, expandCondition, type SourceColumn } from "@/lib/conditions";
import type { ModelContent } from "@/lib/model";
import type { IssueView } from "./model-editor";

/** A dataset or a model that a branch can read (MM-111: a model makes a chain). */
export interface SourceOption {
  key: string;
  label: string;
  kind: "dataset" | "model";
  columns: { name: string; type: string; description?: string }[];
  primaryKey: string[];
}

export interface Join {
  left: string;
  right: string;
  type: "inner" | "left" | "right" | "full";
  condition: Condition;
  cardinality: "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";
  confirmed?: boolean;
  description?: string;
}

export interface Branch {
  label?: string;
  source_tag?: string;
  datasets: Record<string, string>[];
  joins?: Join[];
  filter?: Condition;
  deduplicate?: { key: string[]; order_by?: { column: string; direction: "asc" | "desc" }[]; keep: "first" | "last" };
  group_by?: string[];
}

const JOIN_TYPES = ["inner", "left", "right", "full"] as const;
const CARDINALITIES = ["one_to_one", "one_to_many", "many_to_one", "many_to_many"] as const;
const BRANCH_ORDER = ["label", "source_tag", "datasets", "joins", "filter", "deduplicate", "group_by"];

function ordered(branch: Branch): Branch {
  const result: Record<string, unknown> = {};
  for (const key of BRANCH_ORDER) {
    const value = (branch as unknown as Record<string, unknown>)[key];
    const empty = key !== "datasets" && (value === undefined || value === "" || (Array.isArray(value) && value.length === 0));
    if (!empty) result[key] = value;
  }
  return result as unknown as Branch;
}

/** The alias and source of each dataset use (`- alias: system.dataset`). */
const uses = (branch: Branch) => (branch.datasets ?? []).map((use) => Object.entries(use)[0] ?? ["", ""]);

/** The columns a branch can read, as `alias.COLUMN` with their types. */
export function branchColumns(branch: Branch, sources: SourceOption[]): SourceColumn[] {
  return uses(branch).flatMap(([alias, key]) =>
    (sources.find((source) => source.key === key)?.columns ?? []).map((column) => ({ ref: `${alias}.${column.name}`, type: column.type, ...(column.description ? { description: column.description } : {}) })),
  );
}

/** Opens the stored branches: short forms of conditions are expanded so that the forms have one shape. */
export function openBranches(raw: Record<string, unknown>): Record<string, Branch> {
  return Object.fromEntries(
    Object.entries(raw).map(([id, value]) => {
      const branch = value as Branch;
      return [
        id,
        {
          ...branch,
          datasets: branch.datasets ?? [],
          ...(branch.joins ? { joins: branch.joins.map((join) => ({ ...join, condition: expandCondition(join.condition) })) } : {}),
          ...(branch.filter ? { filter: expandCondition(branch.filter) } : {}),
        },
      ];
    }),
  );
}

/** MAP-031: equalities between the right dataset's key columns and the left columns of the same name. */
function proposeKeys(join: Join, branch: Branch, sources: SourceOption[]): Condition {
  const sourceOf = (alias: string) => sources.find((source) => source.key === uses(branch).find(([a]) => a === alias)?.[1]);
  const left = sourceOf(join.left);
  const right = sourceOf(join.right);
  const keys = right?.primaryKey.length ? right.primaryKey : (left?.primaryKey ?? []);
  const pairs = keys
    .filter((name) => left?.columns.some((column) => column.name === name) && right?.columns.some((column) => column.name === name))
    .map((name) => ({ left: `${join.left}.${name}`, op: "eq", right: `${join.right}.${name}` }) as Comparison);
  return pairs.length === 1 ? (pairs[0] as Condition) : ({ all: pairs } as Condition);
}

/** MAP-022, MAP-030…MAP-032: branches with their dataset uses, joins, filter, deduplication and grouping. */
export function BranchesTab({
  model,
  change,
  sources,
  disabled,
  issues,
}: {
  model: ModelContent;
  change: (update: (current: ModelContent) => ModelContent) => void;
  sources: SourceOption[];
  disabled: boolean;
  issues: IssueView[];
}) {
  const t = useTranslations("Branches");
  const branches = model.branches as Record<string, Branch>;
  const [newId, setNewId] = useState("");

  const setBranch = (id: string, update: (branch: Branch) => Branch) =>
    change((current) => ({ ...current, branches: { ...current.branches, [id]: ordered(update(current.branches[id] as Branch)) } }));

  /** A branch id is also the key of its mappings and of the consolidation's priorities: they follow a rename. */
  const renameBranch = (from: string, to: string) =>
    change((current) => {
      if (!/^[a-z0-9_-]+$/.test(to) || to in current.branches) return current;
      const columns = Object.fromEntries(
        Object.entries(current.columns).map(([name, column]) => [name, { ...column, from: Object.fromEntries(Object.entries(column.from).map(([key, mapping]) => [key === from ? to : key, mapping])) }]),
      );
      return { ...current, branches: Object.fromEntries(Object.entries(current.branches).map(([key, branch]) => [key === from ? to : key, branch])), columns };
    });

  const removeBranch = (id: string) =>
    change((current) => {
      const nextBranches = { ...current.branches };
      delete nextBranches[id];
      const columns = Object.fromEntries(
        Object.entries(current.columns).map(([name, column]) => [name, { ...column, from: Object.fromEntries(Object.entries(column.from).filter(([key]) => key !== id)) }]),
      );
      return { ...current, branches: nextBranches, columns };
    });

  const addBranch = () => {
    const id = newId.trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(id) || id in branches) return;
    change((current) => ({ ...current, branches: { ...current.branches, [id]: { datasets: [] } } }));
    setNewId("");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro")}</p>
      {Object.entries(branches).map(([id, branch]) => (
        <BranchCard
          key={id}
          id={id}
          branch={branch}
          sources={sources}
          disabled={disabled}
          issues={issues.filter((issue) => issue.at === `branches.${id}` || issue.at.startsWith(`branches.${id}.`))}
          onChange={(update) => setBranch(id, update)}
          onRename={(to) => renameBranch(id, to)}
          onRemove={() => removeBranch(id)}
        />
      ))}
      {Object.keys(branches).length === 0 ? <p className="text-sm text-muted">{t("none")}</p> : null}
      {!disabled ? (
        <div className="flex items-end gap-2">
          <Field label={t("newBranch")} hint={t("newBranchHint")} htmlFor="new-branch">
            <Input id="new-branch" value={newId} className="w-56 font-mono" onChange={(event) => setNewId(event.target.value.toLowerCase())} onKeyDown={(event) => event.key === "Enter" && addBranch()} />
          </Field>
          <Button variant="secondary" onClick={addBranch} disabled={!/^[a-z0-9_-]+$/.test(newId) || newId in branches}>
            {t("add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BranchCard({
  id,
  branch,
  sources,
  disabled,
  issues,
  onChange,
  onRename,
  onRemove,
}: {
  id: string;
  branch: Branch;
  sources: SourceOption[];
  disabled: boolean;
  issues: IssueView[];
  onChange: (update: (branch: Branch) => Branch) => void;
  onRename: (to: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Branches");
  const [idDraft, setIdDraft] = useState(id);
  const [shownId, setShownId] = useState(id);
  if (shownId !== id) {
    setShownId(id);
    setIdDraft(id);
  }
  const columns = branchColumns(branch, sources);
  const aliases = uses(branch).map(([alias]) => alias);
  const set = (patch: Partial<Branch>) => onChange((current) => ({ ...current, ...patch }));
  const setUse = (index: number, alias: string, key: string) => set({ datasets: branch.datasets.map((use, position) => (position === index ? { [alias]: key } : use)) });
  const setJoin = (index: number, patch: Partial<Join>) => set({ joins: (branch.joins ?? []).map((join, position) => (position === index ? { ...join, ...patch } : join)) });

  return (
    <Card className="flex flex-col gap-4" aria-label={t("branchOf", { id })}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono font-bold">{id}</h3>
        {!disabled ? (
          <Button variant="ghost" size="sm" className="text-danger" onClick={onRemove}>
            {t("remove")}
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("id")} htmlFor={`b-${id}-id`}>
          <Input id={`b-${id}-id`} value={idDraft} disabled={disabled} className="font-mono" onChange={(event) => setIdDraft(event.target.value.toLowerCase())} onBlur={() => (idDraft !== id ? onRename(idDraft) : null)} />
        </Field>
        <Field label={t("label")} htmlFor={`b-${id}-label`}>
          <Input id={`b-${id}-label`} value={branch.label ?? ""} disabled={disabled} onChange={(event) => set({ label: event.target.value })} />
        </Field>
        <Field label={t("sourceTag")} htmlFor={`b-${id}-tag`}>
          <Input id={`b-${id}-tag`} value={branch.source_tag ?? ""} disabled={disabled} className="font-mono" onChange={(event) => set({ source_tag: event.target.value })} />
        </Field>
      </div>

      {issues.map((issue) => (
        <p key={issue.code + issue.at + issue.message} className="text-xs">
          <Badge tone={issue.severity === "error" ? "danger" : "warning"}>{issue.code}</Badge> <span className="font-mono text-muted">{issue.at}</span> {issue.message}
        </p>
      ))}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("datasets")}</h3>
        <p className="text-xs text-muted">{t("datasetsHint")}</p>
        {uses(branch).map(([alias, key], index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Input aria-label={t("aliasOf", { id, n: index + 1 })} value={alias} disabled={disabled} className="w-24 font-mono" onChange={(event) => setUse(index, event.target.value, key ?? "")} />
            <Select aria-label={t("sourceOf", { id, n: index + 1 })} value={key} disabled={disabled} className="min-w-0 flex-1" onChange={(event) => setUse(index, alias ?? "", event.target.value)}>
              <option value="">{t("chooseSource")}</option>
              <optgroup label={t("sourceDatasets")}>
                {sources.filter((source) => source.kind === "dataset").map((source) => (
                  <option key={source.key} value={source.key}>
                    {source.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("sourceModels")}>
                {sources.filter((source) => source.kind === "model").map((source) => (
                  <option key={source.key} value={source.key}>
                    {source.label}
                  </option>
                ))}
              </optgroup>
            </Select>
            {index === 0 ? <Badge>{t("drivesGrain")}</Badge> : null}
            {!disabled ? (
              <Button variant="ghost" size="icon" aria-label={t("removeUse", { id, n: index + 1 })} onClick={() => set({ datasets: branch.datasets.filter((_, position) => position !== index) })}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
        {!disabled ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => {
              const used = new Set(aliases);
              const alias = "abcdefghijklmnopqrstuvwxyz".split("").find((letter) => !used.has(letter)) ?? `d${aliases.length + 1}`;
              set({ datasets: [...branch.datasets, { [alias]: "" }] });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden /> {t("addUse")}
          </Button>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("joins")}</h3>
        {(branch.joins ?? []).map((join, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-md border border-line p-3" aria-label={t("joinOf", { id, n: index + 1 })}>
            <div className="flex flex-wrap items-center gap-2 [&>select]:w-auto [&>select]:min-w-32">
              <Select aria-label={t("joinLeft", { id, n: index + 1 })} value={join.left} disabled={disabled} onChange={(event) => setJoin(index, { left: event.target.value })}>
                {aliases.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </Select>
              <Select aria-label={t("joinType", { id, n: index + 1 })} value={join.type} disabled={disabled} onChange={(event) => setJoin(index, { type: event.target.value as Join["type"] })}>
                {JOIN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`joinTypes.${type}`)}
                  </option>
                ))}
              </Select>
              <Select aria-label={t("joinRight", { id, n: index + 1 })} value={join.right} disabled={disabled} onChange={(event) => setJoin(index, { right: event.target.value })}>
                {aliases.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </Select>
              <Select aria-label={t("joinCardinality", { id, n: index + 1 })} value={join.cardinality} disabled={disabled} onChange={(event) => setJoin(index, { cardinality: event.target.value as Join["cardinality"] })}>
                {CARDINALITIES.map((cardinality) => (
                  <option key={cardinality} value={cardinality}>
                    {t(`cardinalities.${cardinality}`)}
                  </option>
                ))}
              </Select>
              {!disabled ? (
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => set({ joins: (branch.joins ?? []).filter((_, position) => position !== index) })}>
                  {t("removeJoin")}
                </Button>
              ) : null}
            </div>
            {join.cardinality === "many_to_many" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(join.confirmed)} disabled={disabled} onChange={(event) => setJoin(index, { confirmed: event.target.checked || undefined } as Partial<Join>)} />
                {t("confirmed")}
              </label>
            ) : null}
            <ConditionEditor value={join.condition} columns={columns} disabled={disabled} label={t("conditionOf", { id, n: index + 1 })} onChange={(condition) => setJoin(index, { condition })} />
            {!disabled ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setJoin(index, { condition: proposeKeys(join, branch, sources) })}>
                {t("proposeKeys")}
              </Button>
            ) : null}
            <Textarea aria-label={t("joinDescription", { id, n: index + 1 })} placeholder={t("joinDescriptionPlaceholder")} value={join.description ?? ""} disabled={disabled} className="min-h-12" onChange={(event) => setJoin(index, { description: event.target.value || undefined } as Partial<Join>)} />
          </div>
        ))}
        {!disabled && aliases.length >= 2 ? (
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => set({ joins: [...(branch.joins ?? []), { left: aliases[0] ?? "", right: aliases[(branch.joins?.length ?? 0) + 1] ?? aliases[1] ?? "", type: "left", condition: { all: [] } as unknown as Condition, cardinality: "many_to_one" }] })}
          >
            <Plus className="h-4 w-4" aria-hidden /> {t("addJoin")}
          </Button>
        ) : null}
        {aliases.length < 2 ? <p className="text-xs text-muted">{t("joinsHint")}</p> : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("filter")}</h3>
        <OptionalCondition value={branch.filter} columns={columns} disabled={disabled} label={t("filterOf", { id })} addLabel={t("addFilter")} onChange={(filter) => onChange((current) => ({ ...current, filter }) as Branch)} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">{t("deduplicate")}</h3>
          {branch.deduplicate ? (
            <div className="flex flex-col gap-2">
              <TokenInput aria-label={t("dedupKey", { id })} placeholder={t("columnsPlaceholder")} value={branch.deduplicate.key} disabled={disabled} className="font-mono" onCommit={(key) => set({ deduplicate: { ...branch.deduplicate!, key } })} />
              <TokenInput
                aria-label={t("dedupOrder", { id })}
                placeholder={t("orderPlaceholder")}
                value={(branch.deduplicate.order_by ?? []).map((item) => `${item.column} ${item.direction}`)}
                disabled={disabled}
                className="font-mono"
                onCommit={(items) =>
                  set({
                    deduplicate: {
                      ...branch.deduplicate!,
                      order_by: items.map((item) => {
                        const [column = "", direction = "asc"] = item.split(/\s+/);
                        return { column, direction: direction === "desc" ? "desc" : "asc" };
                      }),
                    },
                  })
                }
              />
              <Select aria-label={t("dedupKeep", { id })} value={branch.deduplicate.keep} disabled={disabled} onChange={(event) => set({ deduplicate: { ...branch.deduplicate!, keep: event.target.value as "first" | "last" } })}>
                <option value="first">{t("keepFirst")}</option>
                <option value="last">{t("keepLast")}</option>
              </Select>
              {!disabled ? (
                <Button variant="ghost" size="sm" className="self-start text-danger" onClick={() => onChange((current) => ({ ...current, deduplicate: undefined }) as unknown as Branch)}>
                  {t("removeDedup")}
                </Button>
              ) : null}
            </div>
          ) : !disabled ? (
            <Button variant="secondary" size="sm" className="self-start" onClick={() => set({ deduplicate: { key: [], keep: "first" } })}>
              {t("addDedup")}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">{t("groupBy")}</h3>
          <p className="text-xs text-muted">{t("groupByHint")}</p>
          <TokenInput aria-label={t("groupByOf", { id })} placeholder={t("columnsPlaceholder")} value={branch.group_by ?? []} disabled={disabled} className="font-mono" onCommit={(group_by) => onChange((current) => ({ ...current, group_by }))} />
        </div>
      </section>
    </Card>
  );
}
