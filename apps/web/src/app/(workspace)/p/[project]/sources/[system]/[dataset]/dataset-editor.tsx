"use client";

import { DIALECTS, type Dialect, logicalTypeFor, type Severity } from "@atlas/core";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ClipboardEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { type ColumnDraft, DATASET_TYPES, type DatasetDraft } from "@/lib/sources";
import { saveDataset } from "../../actions";

interface Row extends ColumnDraft {
  uid: number;
  /** The logical type follows the native type until the user changes it (SRC-013). */
  auto: boolean;
}

let next = 0;
const toRow = (column: ColumnDraft, auto = false): Row => ({ ...column, uid: next++, auto });
const empty = (): Row => toRow({ name: "", nativeType: "", type: "", nullable: true, keyPosition: null, description: "" }, true);

/** SRC-014: rows pasted from a spreadsheet, with a header row (dictionary columns) or in the order of the grid. */
function pastedRows(text: string, dialect: Dialect): Row[] | null {
  const lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0 || !lines.some((line) => line.includes("\t"))) return null;
  const cells = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  const header = (cells[0] ?? []).map((cell) => cell.toLowerCase());
  const named = header.includes("column") && header.includes("native_type");
  const at = (row: string[], name: string, position: number) => (named ? row[header.indexOf(name)] : row[position]) ?? "";
  return (named ? cells.slice(1) : cells).map((row) => {
    const nativeType = at(row, "native_type", 1);
    const key = Number(at(row, "primary_key_position", 3));
    const nullable = at(row, "nullable", 2).toLowerCase();
    return toRow(
      {
        name: at(row, "column", 0),
        nativeType,
        type: (nativeType && logicalTypeFor(nativeType, dialect)) || "string",
        nullable: !["false", "no", "n", "0"].includes(nullable),
        keyPosition: Number.isInteger(key) && key > 0 ? key : null,
        description: at(row, "description", 4),
      },
      true,
    );
  });
}

export interface IssueView {
  code: string;
  severity: Severity;
  at: string;
  message: string;
}

export function DatasetEditor({ slug, draft, dialect: initialDialect, canEdit, issues }: { slug: string; draft: DatasetDraft; dialect: Dialect; canEdit: boolean; issues: IssueView[] }) {
  const t = useTranslations("Dataset");
  const sources = useTranslations("Sources");
  const errors = useTranslations("Errors");
  const [header, setHeader] = useState({ name: draft.name, datasetType: draft.datasetType, namespace: draft.namespace, description: draft.description, landingName: draft.landingName });
  const [rows, setRows] = useState<Row[]>(() => draft.columns.map((column) => toRow(column)));
  const [dialect, setDialect] = useState<Dialect>(initialDialect);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();

  const editHeader = (patch: Partial<typeof header>) => {
    setDirty(true);
    setHeader((current) => ({ ...current, ...patch }));
  };
  const change = (uid: number, patch: Partial<Row>) => {
    setDirty(true);
    setRows((current) =>
      current.map((row) => {
        if (row.uid !== uid) return row;
        const updated = { ...row, ...patch };
        if ("nativeType" in patch && row.auto) updated.type = logicalTypeFor(updated.nativeType, dialect) ?? updated.type;
        if ("type" in patch) updated.auto = false;
        return updated;
      }),
    );
  };
  const move = (index: number, by: number) => {
    setDirty(true);
    setRows((current) => {
      const copy = [...current];
      const [row] = copy.splice(index, 1);
      if (row) copy.splice(index + by, 0, row);
      return copy;
    });
  };
  const onPaste = (event: ClipboardEvent<HTMLTableSectionElement>) => {
    if (!canEdit) return;
    const pasted = pastedRows(event.clipboardData.getData("text/plain"), dialect);
    if (!pasted) return;
    event.preventDefault();
    setDirty(true);
    setRows((current) => [...current.filter((row) => row.name.trim() !== ""), ...pasted]);
  };
  const names = rows.map((row) => row.name.trim()).filter(Boolean);
  const duplicates = new Set(names.filter((name, index) => names.indexOf(name) !== index));
  const columnIssues = (name: string) => issues.filter((issue) => issue.at === `columns.${name}` || issue.at.startsWith(`columns.${name}.`));

  const save = () =>
    startTransition(async () => {
      const outcome = await saveDataset(slug, { ...draft, ...header, columns: rows.map((row) => ({ name: row.name, nativeType: row.nativeType, type: row.type, nullable: row.nullable, keyPosition: row.keyPosition, description: row.description })) });
      setResult(outcome);
      if (outcome?.ok) setDirty(false);
    });

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={sources("datasetName")} htmlFor="ds-name">
          <Input id="ds-name" value={header.name} disabled={!canEdit} onChange={(event) => editHeader({ name: event.target.value })} />
        </Field>
        <Field label={sources("datasetType")} htmlFor="ds-type">
          <Select id="ds-type" value={header.datasetType} disabled={!canEdit} onChange={(event) => editHeader({ datasetType: event.target.value as DatasetDraft["datasetType"] })}>
            {DATASET_TYPES.map((type) => (
              <option key={type} value={type}>
                {sources(`datasetTypes.${type}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={sources("namespace")} htmlFor="ds-namespace">
          <Input id="ds-namespace" value={header.namespace} disabled={!canEdit} onChange={(event) => editHeader({ namespace: event.target.value })} />
        </Field>
        <Field label={t("landingName")} hint={t("landingNameHint")} htmlFor="ds-landing">
          <Input id="ds-landing" value={header.landingName} disabled={!canEdit} onChange={(event) => editHeader({ landingName: event.target.value })} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label={sources("description")} htmlFor="ds-description">
            <Textarea id="ds-description" value={header.description} disabled={!canEdit} onChange={(event) => editHeader({ description: event.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("columns", { count: names.length })}</h2>
          {canEdit ? <p className="text-xs text-muted">{t("pasteHint")}</p> : null}
        </div>
        <div className="w-48">
          <Field label={t("dialect")} hint={t("dialectHint")} htmlFor="ds-dialect">
            <Select id="ds-dialect" value={dialect} onChange={(event) => setDialect(event.target.value as Dialect)}>
              {DIALECTS.map((item) => (
                <option key={item} value={item}>
                  {t(`dialects.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-2 py-2 font-semibold">{t("name")}</th>
              <th className="px-2 py-2 font-semibold">{t("nativeType")}</th>
              <th className="px-2 py-2 font-semibold">{t("logicalType")}</th>
              <th className="px-2 py-2 text-center font-semibold">{t("nullable")}</th>
              <th className="px-2 py-2 font-semibold">{t("key")}</th>
              <th className="px-2 py-2 font-semibold">{t("description")}</th>
              <th className="px-2 py-2">
                <span className="sr-only">{t("actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody onPaste={onPaste}>
            {rows.map((row, index) => {
              const problems = row.name ? columnIssues(row.name) : [];
              return (
                <tr key={row.uid} className="border-t border-line/60 align-top">
                  <td className="px-2 py-1.5">
                    <Input aria-label={t("nameOf", { index: index + 1 })} value={row.name} disabled={!canEdit} aria-invalid={duplicates.has(row.name.trim()) || undefined} onChange={(event) => change(row.uid, { name: event.target.value })} className="font-mono" />
                    {duplicates.has(row.name.trim()) ? <p className="mt-1 text-xs text-danger">{t("duplicate")}</p> : null}
                    {problems.map((issue) => (
                      <p key={issue.code + issue.message} className="mt-1 text-xs">
                        <Badge tone={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warning" : "info"}>{issue.code}</Badge> {issue.message}
                      </p>
                    ))}
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={t("nativeTypeOf", { index: index + 1 })} value={row.nativeType} disabled={!canEdit} onChange={(event) => change(row.uid, { nativeType: event.target.value })} className="font-mono" />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={t("logicalTypeOf", { index: index + 1 })} value={row.type} disabled={!canEdit} onChange={(event) => change(row.uid, { type: event.target.value })} className="font-mono" />
                    {row.nativeType && !logicalTypeFor(row.nativeType, dialect) && row.auto ? <p className="mt-1 text-xs text-warning">{t("unknownType")}</p> : null}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" aria-label={t("nullableOf", { index: index + 1 })} checked={row.nullable} disabled={!canEdit} onChange={(event) => change(row.uid, { nullable: event.target.checked })} className="mt-2.5" />
                  </td>
                  <td className="w-20 px-2 py-1.5">
                    <Input aria-label={t("keyOf", { index: index + 1 })} type="number" min={1} value={row.keyPosition ?? ""} disabled={!canEdit} onChange={(event) => change(row.uid, { keyPosition: event.target.value ? Number(event.target.value) : null })} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input aria-label={t("descriptionOf", { index: index + 1 })} value={row.description} disabled={!canEdit} onChange={(event) => change(row.uid, { description: event.target.value })} />
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5">
                    {canEdit ? (
                      <>
                        <Button variant="ghost" size="icon" aria-label={t("up", { index: index + 1 })} disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("down", { index: index + 1 })} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("remove", { index: index + 1 })} onClick={() => {
                            setDirty(true);
                            setRows(rows.filter((item) => item.uid !== row.uid));
                          }}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">{t("noColumn")}</p> : null}

      {canEdit ? (
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-paper py-3">
          <Button variant="secondary" onClick={() => {
              setDirty(true);
              setRows([...rows, empty()]);
            }}>
            {t("addColumn")}
          </Button>
          <Button onClick={save} disabled={pending || !dirty || duplicates.size > 0}>
            {pending ? t("saving") : t("save")}
          </Button>
          <span className="text-sm text-muted" role="status">
            {dirty ? t("unsaved") : result?.ok ? t("saved") : ""}
          </span>
          {result && !result.ok ? <Alert>{errors(result.error)}</Alert> : null}
        </div>
      ) : null}
    </div>
  );
}
