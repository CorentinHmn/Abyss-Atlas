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
}: {
  value: Operand | undefined;
  columns: SourceColumn[];
  onChange: (operand: Operand) => void;
  disabled: boolean;
  label: string;
}) {
  const t = useTranslations("Conditions");
  const list = useId();
  if (value !== undefined && typeof value === "object" && "calculate" in value) {
    return <span className="rounded border border-line px-2 py-1.5 font-mono text-xs text-muted">{t("calculation", { fn: value.calculate.function })}</span>;
  }
  const kind = typeof value === "object" && value !== null && "value" in value ? "value" : "column";
  return (
    <div className="flex min-w-0 gap-1">
      <Select
        aria-label={t("operandKind", { label })}
        className="w-[6.5rem] shrink-0"
        value={kind}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "value" ? { value: "" } : "")}
      >
        <option value="column">{t("column")}</option>
        <option value="value">{t("value")}</option>
      </Select>
      {kind === "column" ? (
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
