"use client";

import { FUNCTIONS } from "@atlas/core";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Condition, Operand, SourceColumn } from "@/lib/conditions";
import { newStep, type Step, stepKind, STEP_KINDS, type StepKind } from "@/lib/mappings";
import { cn } from "@/lib/utils";
import { ConditionEditor } from "./condition-editor";
import { OperandInput } from "./operand-input";

export interface Catalogue {
  valueMappings: string[];
  rules: { id: string; parameters: string[] }[];
  /** Datasets and models a lookup can read (`system.dataset` or a model id). */
  lookups: { key: string; label: string; columns: string[] }[];
}

const CONVERT_METHODS = ["cast", "parse", "format"] as const;
const ON_ERROR = ["fail", "set_null", "use_default"] as const;
const ON_UNMATCHED = ["keep", "set_null", "use_default", "fail"] as const;
const AGGREGATES = ["sum", "count", "count_distinct", "min", "max", "avg"] as const;

/**
 * MAP-042…MAP-045: the steps of one mapping as a vertical pipeline. Each step has its own small form; the type it
 * produces is shown after it (from the server's validation, MAP-042).
 */
export function StepList({
  steps,
  columns,
  catalogue,
  types,
  disabled,
  label,
  onChange,
}: {
  steps: Step[];
  columns: SourceColumn[];
  catalogue: Catalogue;
  /** Type after each step, by index. */
  types: (string | undefined)[];
  disabled: boolean;
  label: string;
  onChange: (steps: Step[]) => void;
}) {
  const t = useTranslations("Steps");
  const [adding, setAdding] = useState<StepKind>("convert");
  const set = (index: number, step: Step) => onChange(steps.map((item, position) => (position === index ? step : item)));
  const move = (index: number, by: number) => {
    const copy = [...steps];
    const [step] = copy.splice(index, 1);
    if (step !== undefined) copy.splice(index + by, 0, step);
    onChange(copy);
  };
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const kind = stepKind(step);
        const stepLabel = t("stepOf", { label, n: index + 1, kind: t(`kind.${kind}`) });
        return (
          <li key={index} className={cn("flex flex-col gap-2 rounded-md border border-line p-2", kind === "sql" && "border-warning/50 bg-warning/5")} aria-label={stepLabel}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted tabular-nums">{index + 1}</span>
              <Badge tone={kind === "sql" ? "warning" : "neutral"} className="whitespace-nowrap">{t(`kind.${kind}`)}</Badge>
              {kind === "sql" ? <span className="text-xs text-warning">{t("unstructured")}</span> : null}
              <span className="flex-1" />
              {types[index] ? (
                <span className="whitespace-nowrap font-mono text-xs text-muted" aria-label={t("typeAfter", { label: stepLabel })}>
                  {t("gives", { type: types[index] })}
                </span>
              ) : null}
              {!disabled ? (
                <>
                  <Button variant="ghost" size="icon" aria-label={t("up", { label: stepLabel })} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("down", { label: stepLabel })} disabled={index === steps.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t("remove", { label: stepLabel })} onClick={() => onChange(steps.filter((_, position) => position !== index))}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </>
              ) : null}
            </div>
            <StepForm step={step} columns={columns} catalogue={catalogue} disabled={disabled} label={stepLabel} onChange={(next) => set(index, next)} />
          </li>
        );
      })}
      {!disabled ? (
        <li className="flex flex-wrap items-center gap-2">
          <Select aria-label={t("kindToAdd", { label })} className="w-full sm:w-56" value={adding} onChange={(event) => setAdding(event.target.value as StepKind)}>
            {STEP_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind.${kind}`)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => onChange([...steps, newStep(adding)])}>
            {t("add")}
          </Button>
          <span className="text-xs text-muted">{t(`help.${adding}`)}</span>
        </li>
      ) : null}
    </ol>
  );
}

function StepForm({ step, columns, catalogue, disabled, label, onChange }: { step: Step; columns: SourceColumn[]; catalogue: Catalogue; disabled: boolean; label: string; onChange: (step: Step) => void }) {
  const t = useTranslations("Steps");
  const list = useId();
  if (step === "copy") return null;
  const field = (name: string) => t("fieldOf", { label, field: t(`field.${name}`) });

  if ("constant" in step) {
    return <Input aria-label={field("value")} value={step.constant.value} disabled={disabled} onChange={(event) => onChange({ constant: { value: event.target.value } })} />;
  }
  if ("default" in step) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label={field("value")} className="w-64" value={step.default.value} disabled={disabled} onChange={(event) => onChange({ default: { ...step.default, value: event.target.value } })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(step.default.also_empty)} disabled={disabled} onChange={(event) => onChange({ default: { value: step.default.value, ...(event.target.checked ? { also_empty: true } : {}) } })} />
          {t("alsoEmpty")}
        </label>
      </div>
    );
  }
  if ("convert" in step) {
    const c = step.convert;
    const set = (patch: Partial<typeof c>) => {
      const next = { ...c, ...patch } as typeof c & Record<string, unknown>;
      for (const key of ["pattern", "default"]) if (next[key] === "") delete next[key];
      onChange({ convert: next });
    };
    return (
      <div className="flex flex-wrap gap-2">
        <Input aria-label={field("to")} className="w-40 font-mono" value={c.to} disabled={disabled} onChange={(event) => set({ to: event.target.value })} />
        <Select aria-label={field("method")} className="w-32" value={c.method} disabled={disabled} onChange={(event) => set({ method: event.target.value as typeof c.method })}>
          {CONVERT_METHODS.map((method) => (
            <option key={method} value={method}>
              {t(`method.${method}`)}
            </option>
          ))}
        </Select>
        {c.method !== "cast" ? <Input aria-label={field("pattern")} placeholder="YYYYMMDD" className="w-36 font-mono" value={c.pattern ?? ""} disabled={disabled} onChange={(event) => set({ pattern: event.target.value })} /> : null}
        <Select aria-label={field("onError")} className="w-44" value={c.on_error} disabled={disabled} onChange={(event) => set({ on_error: event.target.value as typeof c.on_error })}>
          {ON_ERROR.map((item) => (
            <option key={item} value={item}>
              {t(`onError.${item}`)}
            </option>
          ))}
        </Select>
        {c.on_error === "use_default" ? <Input aria-label={field("default")} className="w-36" value={c.default ?? ""} disabled={disabled} onChange={(event) => set({ default: event.target.value })} /> : null}
      </div>
    );
  }
  if ("map_values" in step) {
    const m = step.map_values;
    return (
      <div className="flex flex-wrap gap-2">
        <Input aria-label={field("mapping")} list={list} className="w-72 font-mono" value={m.mapping} disabled={disabled} onChange={(event) => onChange({ map_values: { ...m, mapping: event.target.value } })} />
        <datalist id={list}>
          {catalogue.valueMappings.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
        <Select aria-label={field("onUnmatched")} className="w-52" value={m.on_unmatched} disabled={disabled} onChange={(event) => onChange({ map_values: { ...m, on_unmatched: event.target.value as typeof m.on_unmatched } })}>
          {ON_UNMATCHED.map((item) => (
            <option key={item} value={item}>
              {t(`onUnmatched.${item}`)}
            </option>
          ))}
        </Select>
      </div>
    );
  }
  if ("case" in step) {
    const c = step.case;
    return (
      <div className="flex flex-col gap-2">
        {c.when.map((branch, index) => (
          <div key={index} className="flex flex-col gap-2 rounded border border-line p-2">
            <span className="text-xs font-semibold text-muted">{t("when", { n: index + 1 })}</span>
            <ConditionEditor value={branch.if} columns={columns} disabled={disabled} label={t("whenOf", { label, n: index + 1 })} onChange={(condition) => onChange({ case: { ...c, when: c.when.map((item, position) => (position === index ? { ...item, if: condition } : item)) } })} />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{t("then")}</span>
              <div className="min-w-60 flex-1">
                <OperandInput value={branch.then} columns={columns} disabled={disabled} label={t("thenOf", { label, n: index + 1 })} onChange={(operand) => onChange({ case: { ...c, when: c.when.map((item, position) => (position === index ? { ...item, then: operand } : item)) } })} />
              </div>
              {!disabled && c.when.length > 1 ? (
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => onChange({ case: { ...c, when: c.when.filter((_, position) => position !== index) } })}>
                  {t("removeWhen")}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {!disabled ? (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => onChange({ case: { ...c, when: [...c.when, { if: { left: "current", op: "eq", right: { value: "" } } as Condition, then: { value: "" } }] } })}>
            {t("addWhen")}
          </Button>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">{t("else")}</span>
          <div className="min-w-60 flex-1">
            <OperandInput value={c.else} columns={columns} disabled={disabled} label={t("elseOf", { label })} onChange={(operand) => onChange({ case: { ...c, else: operand } })} />
          </div>
        </div>
      </div>
    );
  }
  if ("calculate" in step) {
    const c = step.calculate;
    const signature = FUNCTIONS[c.function];
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Select
            aria-label={field("function")}
            className="w-56"
            value={c.function}
            disabled={disabled}
            onChange={(event) => {
              const count = FUNCTIONS[event.target.value]?.args.length ?? 1;
              onChange({ calculate: { function: event.target.value, args: Array.from({ length: count }, (_, index) => c.args[index] ?? (index === 0 ? "current" : { value: "" })) } });
            }}
          >
            {Object.keys(FUNCTIONS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          {signature ? <span className="text-xs text-muted">{signature.description}</span> : null}
        </div>
        {c.args.map((arg, index) => (
          <OperandInput key={index} value={arg} columns={withCurrent(columns)} disabled={disabled} label={t("argOf", { label, n: index + 1 })} onChange={(operand) => onChange({ calculate: { ...c, args: c.args.map((item, position) => (position === index ? operand : item)) } })} />
        ))}
        {signature?.rest && !disabled ? (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange({ calculate: { ...c, args: [...c.args, { value: "" }] } })}>
            {t("addArg")}
          </Button>
        ) : null}
      </div>
    );
  }
  if ("concat" in step) {
    const c = step.concat;
    return (
      <div className="flex flex-col gap-2">
        {c.parts.map((part, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="min-w-60 flex-1">
              <OperandInput value={part} columns={withCurrent(columns)} disabled={disabled} label={t("partOf", { label, n: index + 1 })} onChange={(operand) => onChange({ concat: { ...c, parts: c.parts.map((item, position) => (position === index ? operand : item)) } })} />
            </div>
            {!disabled && c.parts.length > 2 ? (
              <Button variant="ghost" size="icon" aria-label={t("removePart", { label, n: index + 1 })} onClick={() => onChange({ concat: { ...c, parts: c.parts.filter((_, position) => position !== index) } })}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          {!disabled ? (
            <Button variant="ghost" size="sm" onClick={() => onChange({ concat: { ...c, parts: [...c.parts, { value: "" }] } })}>
              {t("addPart")}
            </Button>
          ) : null}
          <Input aria-label={field("separator")} placeholder={t("separator")} className="w-40" value={c.separator ?? ""} disabled={disabled} onChange={(event) => onChange({ concat: { parts: c.parts, ...(event.target.value ? { separator: event.target.value } : {}) } })} />
        </div>
      </div>
    );
  }
  if ("lookup" in step) {
    const l = step.lookup;
    const target = catalogue.lookups.find((item) => item.key === l.dataset);
    const lookupColumns = [...columns, ...(target?.columns ?? []).map((name) => ({ ref: `${l.alias}.${name}`, type: "" }))];
    const set = (patch: Partial<typeof l>) => onChange({ lookup: { ...l, ...patch } });
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Select aria-label={field("dataset")} className="min-w-64 flex-1" value={l.dataset} disabled={disabled} onChange={(event) => set({ dataset: event.target.value })}>
            <option value="">{t("chooseDataset")}</option>
            {catalogue.lookups.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input aria-label={field("alias")} className="w-20 font-mono" value={l.alias} disabled={disabled} onChange={(event) => set({ alias: event.target.value })} />
        </div>
        <ConditionEditor value={l.match} columns={withCurrent(lookupColumns)} disabled={disabled} label={t("matchOf", { label })} onChange={(match) => set({ match })} />
        <div className="flex flex-wrap gap-2">
          <Select aria-label={field("return")} className="min-w-56 flex-1 font-mono" value={l.return} disabled={disabled} onChange={(event) => set({ return: event.target.value })}>
            <option value="">{t("chooseReturn")}</option>
            {(target?.columns ?? []).map((name) => {
              const ref = `${l.alias}.${name}`;
              return (
                <option key={name} value={ref}>
                  {ref}
                </option>
              );
            })}
          </Select>
          <Select aria-label={field("onMissing")} className="w-44" value={l.on_missing} disabled={disabled} onChange={(event) => set({ on_missing: event.target.value as typeof l.on_missing })}>
            {ON_ERROR.map((item) => (
              <option key={item} value={item}>
                {t(`onMissing.${item}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }
  if ("aggregate" in step) {
    return (
      <Select aria-label={field("aggregate")} className="w-48" value={step.aggregate} disabled={disabled} onChange={(event) => onChange({ aggregate: event.target.value as typeof step.aggregate })}>
        {AGGREGATES.map((item) => (
          <option key={item} value={item}>
            {t(`aggregates.${item}`)}
          </option>
        ))}
      </Select>
    );
  }
  if ("rule" in step) {
    const r = step.rule;
    const rule = catalogue.rules.find((item) => item.id === r.id);
    const params = rule?.parameters ?? Object.keys(r.args);
    return (
      <div className="flex flex-col gap-2">
        <Select
          aria-label={field("rule")}
          className="w-72 font-mono"
          value={r.id}
          disabled={disabled}
          onChange={(event) => {
            const chosen = catalogue.rules.find((item) => item.id === event.target.value);
            onChange({ rule: { id: event.target.value, args: Object.fromEntries((chosen?.parameters ?? []).map((name) => [name, r.args[name] ?? "current"])) } });
          }}
        >
          <option value="">{t("chooseRule")}</option>
          {catalogue.rules.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
          {r.id && !rule ? <option value={r.id}>{r.id}</option> : null}
        </Select>
        {params.map((name) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-32 shrink-0 font-mono text-xs">{name}</span>
            <div className="min-w-60 flex-1">
              <OperandInput value={r.args[name] as Operand | undefined} columns={withCurrent(columns)} disabled={disabled} label={t("paramOf", { label, name })} onChange={(operand) => onChange({ rule: { ...r, args: { ...r.args, [name]: operand } } })} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if ("sql" in step) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea aria-label={field("expression")} className="font-mono" value={step.sql.expression} disabled={disabled} onChange={(event) => onChange({ sql: { ...step.sql, expression: event.target.value } })} />
        <Input aria-label={field("reason")} placeholder={t("reasonPlaceholder")} value={step.sql.reason} disabled={disabled} onChange={(event) => onChange({ sql: { ...step.sql, reason: event.target.value } })} />
      </div>
    );
  }
  return null;
}

function withCurrent(columns: SourceColumn[]): SourceColumn[] {
  return [{ ref: "current", type: "" }, ...columns];
}
