"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { TokenInput } from "@/components/ui/token-input";

export const CHECK_KINDS = ["not_null", "unique", "accepted_values", "relationship", "unique_combination"] as const;
export type CheckKind = (typeof CHECK_KINDS)[number];
type Severity = "error" | "warn";

/** A quality check as the format writes it (docs/02-metamodel.md §8): a bare name, or one key with its settings. */
export type QualityCheck =
  | "not_null"
  | "unique"
  | { not_null: { severity: Severity } }
  | { unique: { severity: Severity } }
  | { accepted_values: { values?: string[]; mapping?: string; severity?: Severity } }
  | { relationship: { to: string; severity?: Severity } }
  | { unique_combination: { columns: string[]; severity?: Severity } };

export const checkKind = (check: QualityCheck): CheckKind => (typeof check === "string" ? check : (Object.keys(check)[0] as CheckKind));
const settings = (check: QualityCheck): Record<string, unknown> => (typeof check === "string" ? {} : (Object.values(check)[0] as Record<string, unknown>));

function build(kind: CheckKind, body: Record<string, unknown>): QualityCheck {
  const clean = Object.fromEntries(Object.entries(body).filter(([key, value]) => value !== undefined && value !== "" && !(key === "severity" && value === "error") && !(Array.isArray(value) && value.length === 0)));
  if ((kind === "not_null" || kind === "unique") && Object.keys(clean).length === 0) return kind;
  return { [kind]: clean } as QualityCheck;
}

function newCheck(kind: CheckKind): QualityCheck {
  if (kind === "accepted_values") return { accepted_values: { values: [] } };
  if (kind === "relationship") return { relationship: { to: "" } };
  if (kind === "unique_combination") return { unique_combination: { columns: [] } };
  return kind;
}

/** MAP-025: quality checks of a model or of one column. */
export function QualityList({
  checks,
  kinds,
  columns,
  valueMappings,
  references,
  disabled,
  label,
  onChange,
}: {
  checks: QualityCheck[];
  kinds: readonly CheckKind[];
  columns: string[];
  valueMappings: string[];
  /** `model.column` targets for relationships. */
  references: string[];
  disabled: boolean;
  label: string;
  onChange: (checks: QualityCheck[]) => void;
}) {
  const t = useTranslations("Quality");
  const list = useId();
  const [adding, setAdding] = useState<CheckKind>(kinds[0] ?? "not_null");
  const set = (index: number, check: QualityCheck) => onChange(checks.map((item, position) => (position === index ? check : item)));
  return (
    <div className="flex flex-col gap-2">
      <datalist id={list}>
        {references.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {checks.map((check, index) => {
        const kind = checkKind(check);
        const body = settings(check);
        const checkLabel = t("checkOf", { label, n: index + 1 });
        const update = (patch: Record<string, unknown>) => set(index, build(kind, { ...body, ...patch }));
        return (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-line p-2" aria-label={checkLabel}>
            <span className="w-44 text-sm font-medium">{t(`kind.${kind}`)}</span>
            {kind === "accepted_values" ? (
              body.mapping !== undefined ? (
                <Select aria-label={t("mappingOf", { label: checkLabel })} className="w-64 font-mono" value={String(body.mapping)} disabled={disabled} onChange={(event) => update({ mapping: event.target.value })}>
                  {valueMappings.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </Select>
              ) : (
                <TokenInput aria-label={t("valuesOf", { label: checkLabel })} placeholder={t("valuesPlaceholder")} className="min-w-64 flex-1" value={(body.values as string[] | undefined) ?? []} disabled={disabled} onCommit={(values) => update({ values })} />
              )
            ) : null}
            {kind === "accepted_values" && !disabled && valueMappings.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => set(index, build(kind, body.mapping !== undefined ? { values: [], severity: body.severity } : { mapping: valueMappings[0], severity: body.severity }))}>
                {body.mapping !== undefined ? t("useValues") : t("useMapping")}
              </Button>
            ) : null}
            {kind === "relationship" ? (
              <Input aria-label={t("toOf", { label: checkLabel })} list={list} placeholder="model.column" className="min-w-64 flex-1 font-mono" value={String(body.to ?? "")} disabled={disabled} onChange={(event) => update({ to: event.target.value })} />
            ) : null}
            {kind === "unique_combination" ? (
              <TokenInput aria-label={t("columnsOf", { label: checkLabel })} placeholder={columns.slice(0, 2).join(", ")} className="min-w-64 flex-1 font-mono" value={(body.columns as string[] | undefined) ?? []} disabled={disabled} onCommit={(items) => update({ columns: items })} />
            ) : null}
            <Select aria-label={t("severityOf", { label: checkLabel })} className="w-36" value={String(body.severity ?? "error")} disabled={disabled} onChange={(event) => update({ severity: event.target.value })}>
              <option value="error">{t("severity.error")}</option>
              <option value="warn">{t("severity.warn")}</option>
            </Select>
            {!disabled ? (
              <Button variant="ghost" size="icon" aria-label={t("remove", { label: checkLabel })} onClick={() => onChange(checks.filter((_, position) => position !== index))}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        );
      })}
      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label={t("kindToAdd", { label })} className="w-60" value={adding} onChange={(event) => setAdding(event.target.value as CheckKind)}>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {t(`kind.${kind}`)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={() => onChange([...checks, newCheck(adding)])}>
            {t("add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
