"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Input, Select } from "@/components/ui/input";
import type { Operand, SourceColumn } from "@/lib/conditions";

/** One operand: a column of the branch (picked from a list, with its type) or a typed literal (MAP-005). */
export function OperandInput({
  value,
  columns,
  onChange,
  disabled,
  label,
  params,
}: {
  value: Operand | undefined;
  columns: SourceColumn[];
  onChange: (operand: Operand) => void;
  disabled: boolean;
  label: string;
  /** In a business rule: its parameters, offered as a third kind of operand. */
  params?: string[] | undefined;
}) {
  const t = useTranslations("Conditions");
  const list = useId();
  if (value !== undefined && typeof value === "object" && "calculate" in value) {
    return <span className="rounded border border-line px-2 py-1.5 font-mono text-xs text-muted">{t("calculation", { fn: value.calculate.function })}</span>;
  }
  const kind = typeof value === "object" && value !== null && "value" in value ? "value" : typeof value === "object" && value !== null && "param" in value ? "param" : "column";
  return (
    <div className="flex min-w-0 gap-1">
      <Select
        aria-label={t("operandKind", { label })}
        className={params ? "w-[7.75rem] shrink-0" : "w-[6.5rem] shrink-0"}
        value={kind}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "value" ? { value: "" } : event.target.value === "param" ? { param: params?.[0] ?? "" } : "")}
      >
        <option value="column">{t("column")}</option>
        <option value="value">{t("value")}</option>
        {params ? <option value="param">{t("param")}</option> : null}
      </Select>
      {kind === "param" ? (
        <Select aria-label={label} className="min-w-0 font-mono" value={typeof value === "object" && value !== null && "param" in value ? value.param : ""} disabled={disabled} onChange={(event) => onChange({ param: event.target.value })}>
          {(params ?? []).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      ) : kind === "column" ? (
        <>
          <Input
            aria-label={label}
            list={list}
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            placeholder={t("columnPlaceholder")}
            className="min-w-0 font-mono"
            onChange={(event) => onChange(event.target.value)}
          />
          <datalist id={list}>
            {columns.map((column) => (
              <option key={column.ref} value={column.ref}>
                {column.type}
              </option>
            ))}
          </datalist>
        </>
      ) : (
        <Input
          aria-label={label}
          value={typeof value === "object" && value !== null && "value" in value ? value.value : ""}
          disabled={disabled}
          placeholder={t("valuePlaceholder")}
          className="min-w-0"
          onChange={(event) => onChange({ value: event.target.value })}
        />
      )}
    </div>
  );
}
