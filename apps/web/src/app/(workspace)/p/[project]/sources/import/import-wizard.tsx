"use client";

import { CATALOG_QUERIES, DIALECTS, type Dialect, type DictionaryImportReport, importDictionary, parseCsv, schemas } from "@atlas/core";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { parse } from "yaml";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { today } from "@/lib/sources";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { saveImportedDatasets } from "../actions";

const MAX_BYTES = 20 * 1024 * 1024;
/** Each call carries well under the 1 MB limit of server actions. */
const BATCH_BYTES = 700_000;

interface Workbook {
  name: string;
  sheets: { sheet: string; data: unknown[][] }[];
}

type Stage =
  | { kind: "choose" }
  | { kind: "preview"; report: DictionaryImportReport; datasets: Record<string, unknown>[] }
  | { kind: "done"; saved: number; report: DictionaryImportReport };

/**
 * SCR-032: the file is read and translated here, in the browser (SRC-021): it never leaves the computer; only the
 * resulting datasets are sent, after the preview (SRC-022).
 */
export function ImportWizard({
  slug,
  projectId,
  systems,
  initialSystem,
}: {
  slug: string;
  projectId: string;
  systems: { id: string; name: string; dialect: Dialect }[];
  initialSystem: string;
}) {
  const t = useTranslations("Import");
  const errors = useTranslations("Errors");
  const [system, setSystem] = useState(initialSystem);
  const [dialect, setDialect] = useState<Dialect>(systems.find((item) => item.id === initialSystem)?.dialect ?? "postgresql");
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [sheet, setSheet] = useState(0);
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setStage({ kind: "choose" });
    setProblem(null);
  };

  async function readFile(file: File) {
    reset();
    setWorkbook(null);
    setCsvRows(null);
    if (file.size > MAX_BYTES) return setProblem(t("tooLarge"));
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        const { default: readXlsxFile } = await import("read-excel-file/browser");
        const sheets = await readXlsxFile(file);
        setWorkbook({ name: file.name, sheets: sheets.map((item) => ({ sheet: item.sheet, data: item.data as unknown[][] })) });
        setSheet(0);
      } else {
        setCsvRows(parseCsv(await file.text()));
      }
    } catch {
      setProblem(t("unreadable"));
    }
  }

  const rows = (): string[][] | null => {
    if (csvRows) return csvRows;
    const data = workbook?.sheets[sheet]?.data;
    return data ? data.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)))) : null;
  };

  async function preview() {
    const input = rows();
    if (!input || input.length < 2) return setProblem(t("empty"));
    // IE-004: the datasets of this system already in Atlas are updated, not replaced (read with the user's rights).
    const { data: stored, error } = await createSupabaseBrowserClient()
      .schema("app")
      .from("spec_objects")
      .select("content")
      .eq("project_id", projectId)
      .eq("kind", "dataset")
      .eq("content->>system", system);
    if (error) return setProblem(errors("unavailable"));
    const known = new Map<string, schemas.DatasetSpec>();
    for (const { content } of stored ?? []) {
      const parsed = schemas.datasetSchema.safeParse(content);
      if (parsed.success && parsed.data.system === system) known.set(parsed.data.id, parsed.data);
    }
    const { files, report } = importDictionary({ rows: input, system, dialect, existing: known, date: today() });
    if (report.errors.length > 0) {
      setStage({ kind: "choose" });
      return setProblem(report.errors.slice(0, 5).join(" "));
    }
    setStage({ kind: "preview", report, datasets: files.map((file) => parse(file.content, { version: "1.2" }) as Record<string, unknown>) });
  }

  function confirm(report: DictionaryImportReport, datasets: Record<string, unknown>[]) {
    startTransition(async () => {
      const batches: Record<string, unknown>[][] = [[]];
      let size = 0;
      for (const dataset of datasets) {
        const bytes = JSON.stringify(dataset).length;
        if (size + bytes > BATCH_BYTES && (batches.at(-1)?.length ?? 0) > 0) {
          batches.push([]);
          size = 0;
        }
        batches.at(-1)?.push(dataset);
        size += bytes;
      }
      let saved = 0;
      for (const [index, batch] of batches.entries()) {
        setProgress(t("saving", { done: index, total: batches.length }));
        const outcome = await saveImportedDatasets(slug, system, batch);
        if (!outcome.ok) {
          setProgress(null);
          return setProblem(errors(outcome.error));
        }
        saved += outcome.saved;
      }
      setProgress(null);
      setStage({ kind: "done", saved, report });
    });
  }

  const report = stage.kind === "choose" ? null : stage.report;
  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-3">
        <CardTitle>{t("step1")}</CardTitle>
        <p className="text-sm text-muted">{t("step1Body")}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {(Object.keys(CATALOG_QUERIES) as (keyof typeof CATALOG_QUERIES)[]).map((engine) => (
            <details key={engine} className="rounded-md border border-line">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">{t(`query.${engine}`)}</summary>
              <div className="flex flex-col gap-2 border-t border-line p-3">
                <Button variant="secondary" size="sm" className="self-start" onClick={() => void navigator.clipboard.writeText(CATALOG_QUERIES[engine])}>
                  {t("copyQuery")}
                </Button>
                <pre className="max-h-64 overflow-auto rounded bg-paper p-2 text-xs">{CATALOG_QUERIES[engine]}</pre>
              </div>
            </details>
          ))}
        </div>
        <p className="text-xs text-muted">{t("otherSources")}</p>
      </Card>

      <Card className="flex flex-col gap-4">
        <CardTitle>{t("step2")}</CardTitle>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("system")} htmlFor="import-system">
            <Select
              id="import-system"
              value={system}
              onChange={(event) => {
                setSystem(event.target.value);
                setDialect(systems.find((item) => item.id === event.target.value)?.dialect ?? dialect);
                reset();
              }}
            >
              {systems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("dialect")} hint={t("dialectHint")} htmlFor="import-dialect">
            <Select id="import-dialect" value={dialect} onChange={(event) => (setDialect(event.target.value as Dialect), reset())}>
              {DIALECTS.map((item) => (
                <option key={item} value={item}>
                  {t(`dialects.${item}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("file")} hint={t("fileHint")} htmlFor="import-file">
            <Input id="import-file" type="file" accept=".csv,.txt,.xlsx" onChange={(event) => event.target.files?.[0] && void readFile(event.target.files[0])} />
          </Field>
        </div>
        {workbook && workbook.sheets.length > 1 ? (
          <Field label={t("sheet")} htmlFor="import-sheet">
            <Select id="import-sheet" value={sheet} onChange={(event) => (setSheet(Number(event.target.value)), reset())} className="max-w-xs">
              {workbook.sheets.map((item, index) => (
                <option key={item.sheet} value={index}>
                  {item.sheet}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        {problem ? <Alert>{problem}</Alert> : null}
        <Button className="self-start" disabled={!(csvRows || workbook) || stage.kind !== "choose"} onClick={() => startTransition(preview)}>
          {t("previewAction")}
        </Button>
      </Card>

      {report ? (
        <Card className="flex flex-col gap-4">
          <CardTitle>{t("step3")}</CardTitle>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t("created"), value: report.created.length },
              { label: t("updated"), value: report.updated.length },
              { label: t("missing"), value: report.missingColumns.length },
              { label: t("unknown"), value: report.unknownTypes.length },
            ].map((tile) => (
              <div key={tile.label} className="rounded-md border border-line p-3">
                <dt className="text-xs text-muted">{tile.label}</dt>
                <dd className="text-xl font-bold tabular-nums">{tile.value}</dd>
              </div>
            ))}
          </dl>
          {report.created.length > 0 ? <p className="text-sm">{t("createdList", { list: report.created.slice(0, 30).join(", "), more: Math.max(0, report.created.length - 30) })}</p> : null}
          {report.updated.length > 0 ? <p className="text-sm">{t("updatedList", { list: report.updated.slice(0, 30).join(", "), more: Math.max(0, report.updated.length - 30) })}</p> : null}
          {report.missingColumns.length > 0 ? (
            <Alert tone="info">{t("missingList", { list: report.missingColumns.slice(0, 20).map((item) => `${item.dataset}.${item.column}`).join(", ") })}</Alert>
          ) : null}
          {report.unknownTypes.length > 0 ? (
            <Alert tone="info">{t("unknownList", { list: report.unknownTypes.slice(0, 20).map((item) => `${item.dataset}.${item.column} (${item.nativeType})`).join(", ") })}</Alert>
          ) : null}
          {stage.kind === "preview" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={pending} onClick={() => confirm(stage.report, stage.datasets)}>
                {t("confirm", { count: stage.datasets.length })}
              </Button>
              <Button variant="secondary" disabled={pending} onClick={reset}>
                {t("cancel")}
              </Button>
              {progress ? <span className="text-sm text-muted">{progress}</span> : null}
            </div>
          ) : stage.kind === "done" ? (
            <div className="flex flex-col gap-2">
              <Alert tone="success">{t("done", { count: stage.saved })}</Alert>
              <Link href={`/p/${slug}/sources?system=${system}`} className="text-sm font-semibold text-brand hover:underline">
                {t("seeSources")}
              </Link>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
