"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ModelContent } from "@/lib/model";

type Strategy = "priority" | "first_not_null" | "most_recent" | "rule";
const STRATEGIES: Strategy[] = ["priority", "first_not_null", "most_recent", "rule"];

export interface Consolidation {
  combine: "union_all" | "union_distinct";
  add_source_column?: string;
  match?: string[];
  survivorship?: {
    priority: string[];
    columns?: Record<string, { strategy: Strategy; priority?: string[]; by?: string; rule?: string }>;
  };
}

/** Keys in file order, empty parts left out. */
function ordered(value: Consolidation): Consolidation {
  const result: Consolidation = { combine: value.combine };
  if (value.add_source_column) result.add_source_column = value.add_source_column;
  if (value.match?.length) result.match = value.match;
  if (value.survivorship) {
    const columns = value.survivorship.columns && Object.keys(value.survivorship.columns).length ? value.survivorship.columns : undefined;
    result.survivorship = { priority: value.survivorship.priority, ...(columns ? { columns } : {}) };
  }
  return result;
}

/** Reorders a branch list by drag-free buttons; branches missing from it are appended. */
function PriorityList({ items, all, onChange, disabled, label }: { items: string[]; all: string[]; onChange: (items: string[]) => void; disabled: boolean; label: string }) {
  const t = useTranslations("Consolidation");
  const list = [...items.filter((item) => all.includes(item)), ...all.filter((item) => !items.includes(item))];
  const move = (index: number, by: number) => {
    const copy = [...list];
    const [item] = copy.splice(index, 1);
    if (item) copy.splice(index + by, 0, item);
    onChange(copy);
  };
  return (
    <ol className="flex flex-col gap-1" aria-label={label}>
      {list.map((item, index) => (
        <li key={item} className="flex items-center gap-2 rounded border border-line px-2 py-1 text-sm">
          <span className="w-5 text-xs text-muted tabular-nums">{index + 1}</span>
          <span className="flex-1 font-mono">{item}</span>
          {!disabled ? (
            <>
              <Button variant="ghost" size="icon" aria-label={t("moveUp", { item, label })} disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="icon" aria-label={t("moveDown", { item, label })} disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
            </>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** MAP-024, MM-130…MM-133: how the branches of a model are combined. */
export function ConsolidationTab({
  model,
  change,
  rules,
  disabled,
}: {
  model: ModelContent;
  change: (update: (current: ModelContent) => ModelContent) => void;
  rules: string[];
  disabled: boolean;
}) {
  const t = useTranslations("Consolidation");
  const branches = Object.keys(model.branches);
  const columns = Object.keys(model.columns);
  const value = model.consolidation as Consolidation | undefined;
  const set = (next: Consolidation | undefined) => change((current) => ({ ...current, consolidation: next ? ordered(next) : undefined }));

  if (branches.length < 2 && !value) return <p className="text-sm text-muted">{t("singleBranch")}</p>;
  if (!value) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t("intro")}</p>
        {!disabled ? (
          <Button className="self-start" onClick={() => set({ combine: "union_all", add_source_column: "source_system" })}>
            {t("add")}
          </Button>
        ) : null}
      </div>
    );
  }
  const survivorship = value.survivorship;
  const overrides = Object.entries(survivorship?.columns ?? {});
  const setOverride = (column: string, patch: Partial<NonNullable<NonNullable<Consolidation["survivorship"]>["columns"]>[string]> | null) => {
    const current = { ...(survivorship?.columns ?? {}) };
    if (patch === null) delete current[column];
    else current[column] = { strategy: "priority", ...current[column], ...patch } as (typeof current)[string];
    set({ ...value, survivorship: { priority: survivorship?.priority ?? branches, columns: current } });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro")}</p>
      <Card className="grid gap-4 sm:grid-cols-2">
        <Field label={t("combine")} hint={t("combineHint")} htmlFor="c-combine">
          <Select id="c-combine" value={value.combine} disabled={disabled} onChange={(event) => set({ ...value, combine: event.target.value as Consolidation["combine"] })}>
            <option value="union_all">{t("unionAll")}</option>
            <option value="union_distinct">{t("unionDistinct")}</option>
          </Select>
        </Field>
        <Field label={t("sourceColumn")} hint={t("sourceColumnHint")} htmlFor="c-source">
          <Input id="c-source" className="font-mono" value={value.add_source_column ?? ""} disabled={disabled} onChange={(event) => set({ ...value, add_source_column: event.target.value.toLowerCase() })} />
        </Field>
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">{t("matchTitle")}</h3>
        <p className="text-xs text-muted">{t("matchHint")}</p>
        <div className="flex flex-wrap gap-3">
          {columns.map((column) => (
            <label key={column} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.match?.includes(column) ?? false}
                disabled={disabled}
                onChange={(event) => {
                  const match = event.target.checked ? [...(value.match ?? []), column] : (value.match ?? []).filter((item) => item !== column);
                  set({ ...value, match, ...(match.length && !value.survivorship ? { survivorship: { priority: branches } } : {}) });
                }}
              />
              <span className="font-mono">{column}</span>
            </label>
          ))}
        </div>
      </Card>

      {value.match?.length ? (
        <Card className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">{t("survivorshipTitle")}</h3>
          <p className="text-xs text-muted">{t("survivorshipHint")}</p>
          <PriorityList items={survivorship?.priority ?? branches} all={branches} disabled={disabled} label={t("priority")} onChange={(priority) => set({ ...value, survivorship: { ...survivorship, priority } })} />
          <h4 className="mt-2 text-sm font-semibold">{t("overrides")}</h4>
          {overrides.map(([column, override]) => (
            <div key={column} className="flex flex-col gap-2 rounded-md border border-line p-3" aria-label={t("overrideOf", { column })}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{column}</span>
                <Select aria-label={t("strategyOf", { column })} className="w-56" value={override.strategy} disabled={disabled} onChange={(event) => setOverride(column, { strategy: event.target.value as Strategy })}>
                  {STRATEGIES.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {t(`strategy.${strategy}`)}
                    </option>
                  ))}
                </Select>
                <span className="flex-1" />
                {!disabled ? (
                  <Button variant="ghost" size="icon" aria-label={t("removeOverride", { column })} onClick={() => setOverride(column, null)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
              {override.strategy === "priority" || override.strategy === "first_not_null" ? (
                <PriorityList items={override.priority ?? survivorship?.priority ?? branches} all={branches} disabled={disabled} label={t("priorityOf", { column })} onChange={(priority) => setOverride(column, { priority })} />
              ) : null}
              {override.strategy === "most_recent" ? (
                <Select aria-label={t("byOf", { column })} className="w-64 font-mono" value={override.by ?? ""} disabled={disabled} onChange={(event) => setOverride(column, { by: event.target.value })}>
                  <option value="">{t("chooseColumn")}</option>
                  {columns.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              ) : null}
              {override.strategy === "rule" ? (
                <Select aria-label={t("ruleOf", { column })} className="w-64 font-mono" value={override.rule ?? ""} disabled={disabled} onChange={(event) => setOverride(column, { rule: event.target.value })}>
                  <option value="">{t("chooseRule")}</option>
                  {rules.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <Select aria-label={t("addOverride")} className="w-72" value="" onChange={(event) => event.target.value && setOverride(event.target.value, { strategy: "first_not_null" })}>
              <option value="">{t("addOverride")}</option>
              {columns
                .filter((column) => !(survivorship?.columns ?? {})[column])
                .map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
            </Select>
          ) : null}
        </Card>
      ) : null}

      {!disabled ? (
        <Button variant="ghost" className="self-start text-danger" onClick={() => set(undefined)}>
          {t("remove")}
        </Button>
      ) : null}
    </div>
  );
}
