"use client";

import { isComparable, parseLogicalType } from "@atlas/core";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { TokenInput } from "@/components/ui/token-input";
import { type Comparison, type Condition, emptyComparison, isColumn, type Operand, OPERATORS, type Operator, rightSide, type SourceColumn } from "@/lib/conditions";
import { cn } from "@/lib/utils";
import { OperandInput } from "./operand-input";

const typeOf = (operand: unknown, columns: SourceColumn[]) => (isColumn(operand) ? columns.find((column) => column.ref === operand)?.type : undefined);

/** MAP-031: two columns of incompatible types are flagged at once (MM-120). */
function incompatible(left: unknown, right: unknown, columns: SourceColumn[]): boolean {
  const a = typeOf(left, columns);
  const b = typeOf(right, columns);
  if (!a || !b) return false;
  const pa = parseLogicalType(a);
  const pb = parseLogicalType(b);
  return Boolean(pa && pb && !isComparable(pa, pb));
}

/**
 * MAP-044: one builder for joins, filters, `case` and `lookup`. A condition is a comparison, a group (`all`, `any`),
 * a negation, or the `sql` escape hatch (unstructured, with its reason, MM-210).
 */
export function ConditionEditor({
  value,
  columns,
  onChange,
  onRemove,
  disabled,
  label,
  depth = 0,
  params,
}: {
  /** In a business rule: its parameters, usable as operands. */
  params?: string[] | undefined;
  value: Condition;
  columns: SourceColumn[];
  onChange: (condition: Condition) => void;
  onRemove?: () => void;
  disabled: boolean;
  label: string;
  depth?: number;
}) {
  const t = useTranslations("Conditions");
  const remove = onRemove ? (
    <Button variant="ghost" size="icon" aria-label={t("remove", { label })} disabled={disabled} onClick={onRemove}>
      <X className="h-4 w-4" aria-hidden />
    </Button>
  ) : null;

  if ("all" in value || "any" in value) {
    const mode = "all" in value ? "all" : "any";
    const children = ("all" in value ? value.all : value.any) as Condition[];
    const set = (next: Condition[]) => onChange((mode === "all" ? { all: next } : { any: next }) as Condition);
    return (
      <div className={cn("flex flex-col gap-2 rounded-md border border-line p-2", depth > 0 && "bg-paper")}>
        <div className="flex items-center gap-2">
          <Select aria-label={t("groupMode", { label })} className="w-56" value={mode} disabled={disabled} onChange={(event) => onChange((event.target.value === "all" ? { all: children } : { any: children }) as Condition)}>
            <option value="all">{t("all")}</option>
            <option value="any">{t("any")}</option>
          </Select>
          <span className="flex-1" />
          {remove}
        </div>
        {children.map((child, index) => (
          <ConditionEditor
            params={params}
            key={index}
            value={child}
            columns={columns}
            disabled={disabled}
            depth={depth + 1}
            label={`${label} ${index + 1}`}
            onChange={(next) => set(children.map((item, position) => (position === index ? next : item)))}
            onRemove={() => set(children.filter((_, position) => position !== index))}
          />
        ))}
        {!disabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => set([...children, emptyComparison()])}>
              {t("addComparison")}
            </Button>
            {depth < 2 ? (
              <Button variant="ghost" size="sm" onClick={() => set([...children, { any: [emptyComparison()] } as Condition])}>
                {t("addGroup")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if ("not" in value) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-line p-2">
        <div className="flex items-center gap-2">
          <Badge>{t("not")}</Badge>
          <span className="flex-1" />
          {remove}
        </div>
        <ConditionEditor params={params} value={value.not} columns={columns} disabled={disabled} depth={depth + 1} label={label} onChange={(next) => onChange({ not: next })} />
      </div>
    );
  }

  if ("sql" in value) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-warning/50 bg-warning/5 p-2">
        <div className="flex items-center gap-2">
          <Badge tone="warning">{t("unstructured")}</Badge>
          <span className="flex-1" />
          {remove}
        </div>
        <Textarea aria-label={t("sqlOf", { label })} className="font-mono" value={value.sql} disabled={disabled} onChange={(event) => onChange({ ...value, sql: event.target.value })} />
        <Input aria-label={t("reasonOf", { label })} placeholder={t("reasonPlaceholder")} value={value.reason} disabled={disabled} onChange={(event) => onChange({ ...value, reason: event.target.value })} />
      </div>
    );
  }

  const comparison = value as Comparison;
  const side = rightSide(comparison.op as Operator);
  const values = comparison.values ?? [];
  const mismatch = side === "operand" && incompatible(comparison.left, comparison.right, columns);
  const setComparison = (patch: Partial<Comparison>) => {
    const next = { ...comparison, ...patch } as Comparison & Record<string, unknown>;
    const nextSide = rightSide(next.op as Operator);
    if (nextSide !== "operand") delete next.right;
    if (nextSide !== "values" && nextSide !== "between") delete next.values;
    if (nextSide === "operand" && next.right === undefined) next.right = "";
    if ((nextSide === "values" || nextSide === "between") && !next.values) next.values = [];
    delete next.value;
    onChange(next as Condition);
  };
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-60 flex-1">
          <OperandInput params={params} value={comparison.left as Operand} columns={columns} disabled={disabled} label={t("leftOf", { label })} onChange={(left) => setComparison({ left } as Partial<Comparison>)} />
        </div>
        <Select aria-label={t("operatorOf", { label })} className="w-40" value={comparison.op} disabled={disabled} onChange={(event) => setComparison({ op: event.target.value as Operator } as Partial<Comparison>)}>
          {OPERATORS.map((op) => (
            <option key={op} value={op}>
              {t(`op.${op}`)}
            </option>
          ))}
        </Select>
        <div className="min-w-60 flex-1">
        {side === "operand" ? (
          <OperandInput
            value={(comparison.right ?? (comparison.value !== undefined ? { value: String(comparison.value) } : "")) as Operand}
            columns={columns}
            disabled={disabled}
            label={t("rightOf", { label })}
            onChange={(right) => setComparison({ right } as Partial<Comparison>)}
          />
        ) : side === "values" ? (
          <TokenInput aria-label={t("valuesOf", { label })} placeholder={t("valuesPlaceholder")} value={values} disabled={disabled} onCommit={(next) => setComparison({ values: next } as Partial<Comparison>)} />
        ) : side === "between" ? (
          <div className="flex gap-1">
            <Input aria-label={t("fromOf", { label })} value={values[0] ?? ""} disabled={disabled} onChange={(event) => setComparison({ values: [event.target.value, values[1] ?? ""] } as Partial<Comparison>)} />
            <Input aria-label={t("toOf", { label })} value={values[1] ?? ""} disabled={disabled} onChange={(event) => setComparison({ values: [values[0] ?? "", event.target.value] } as Partial<Comparison>)} />
          </div>
        ) : null}
        </div>
        {remove}
      </div>
      {mismatch ? <p className="text-xs text-danger">{t("incompatible", { left: typeOf(comparison.left, columns) ?? "", right: typeOf(comparison.right, columns) ?? "" })}</p> : null}
    </div>
  );
}


/** Condition editor with the actions that turn an empty value into a condition. */
export function OptionalCondition({
  value,
  columns,
  onChange,
  disabled,
  label,
  addLabel,
}: {
  value: Condition | undefined;
  columns: SourceColumn[];
  onChange: (condition: Condition | undefined) => void;
  disabled: boolean;
  label: string;
  addLabel: string;
}) {
  const t = useTranslations("Conditions");
  if (!value) {
    return disabled ? null : (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onChange(emptyComparison() as Condition)}>
          {addLabel}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange({ sql: "", reason: "" })}>
          {t("addSql")}
        </Button>
      </div>
    );
  }
  return <ConditionEditor value={value} columns={columns} disabled={disabled} label={label} onChange={onChange} onRemove={() => onChange(undefined)} />;
}
