"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { useSpecDocument } from "@/components/spec/use-spec-document";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Table, Td, Th } from "@/components/ui/table";
import { MAX_ENTRIES, normalizeValueMapping, type ValueMappingContent } from "@/lib/reusable";
import { YamlView } from "@/components/spec/yaml-view";
import { cn } from "@/lib/utils";
import { EditorHeader, type IssueView, Problems, type UseView, ViewTabs, WhereUsed } from "../../reusable-shared";
import { saveReusable } from "../../spec-actions";

interface Row {
  from: string;
  to: string;
}

/** The editor's form: the entries as rows (duplicates can exist while typing), and the chosen source of values. */
interface Draft {
  id: string;
  name: string;
  domain: string;
  from_type: string;
  to_type: string;
  reference?: { dataset: string; key: string; value: string } | undefined;
  default?: string | undefined;
  mode: "entries" | "reference";
  rows: Row[];
}

function open(content: ValueMappingContent): Draft {
  const { id, name, domain, from_type, to_type, reference } = content;
  return {
    id,
    name,
    domain,
    from_type,
    to_type,
    reference,
    default: content.default,
    mode: reference ? "reference" : "entries",
    rows: Object.entries(content.entries ?? {}).map(([from, to]) => ({ from, to: String(to) })),
  };
}

/** Back to the stored form: the first row of a duplicated value wins (the others are flagged). */
function store(draft: Draft): ValueMappingContent {
  const { mode, rows, reference, ...rest } = draft;
  const base = { ...rest, default: rest.default } as ValueMappingContent;
  if (mode === "reference") return { ...base, reference: reference ?? { dataset: "", key: "", value: "" } };
  const entries: Record<string, string> = {};
  for (const row of rows) if (row.from !== "" && !(row.from in entries)) entries[row.from] = row.to;
  return { ...base, entries };
}

/** Rows pasted from a spreadsheet: one per line, the two values separated by a tab, a semicolon or a comma. */
export function parsePasted(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const separator = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
      const [from = "", ...rest] = line.split(separator);
      return { from: from.trim(), to: rest.join(separator).trim() };
    });
}

/** SCR-041, MAP-052: a value mapping, inline entries or a reference dataset, saved automatically. */
export function ValueMappingEditor({
  slug,
  initial,
  domains,
  sources,
  issues,
  uses,
  canEdit,
}: {
  slug: string;
  initial: ValueMappingContent;
  domains: { code: string; name: string; retired: boolean }[];
  sources: { key: string; label: string; columns: string[] }[];
  issues: IssueView[];
  uses: UseView[];
  canEdit: boolean;
}) {
  const t = useTranslations("Reusable");
  const router = useRouter();
  const save = useCallback(
    async (draft: Draft) => {
      const result = await saveReusable(slug, "value_mapping", store(draft));
      if (result?.ok) router.refresh();
      return Boolean(result?.ok);
    },
    [slug, router],
  );
  const [opened] = useState(() => open(initial));
  const { doc, change, undo, redo, canUndo, canRedo, state, retry } = useSpecDocument<Draft>(opened, save);
  const [pasted, setPasted] = useState("");
  const [view, setView] = useState<"form" | "yaml">("form");
  const stored = useMemo(() => normalizeValueMapping(store(doc)) as Record<string, unknown>, [doc]);
  const disabled = !canEdit;
  const set = (patch: Partial<Draft>) => change((current) => ({ ...current, ...patch }));
  const setRow = (index: number, patch: Partial<Row>) => change((current) => ({ ...current, rows: current.rows.map((row, position) => (position === index ? { ...row, ...patch } : row)) }));
  const seen = new Set<string>();
  const duplicate = doc.rows.map((row) => {
    const repeated = row.from !== "" && seen.has(row.from);
    seen.add(row.from);
    return repeated;
  });
  const duplicates = duplicate.filter(Boolean).length;
  const reference = doc.reference ?? { dataset: "", key: "", value: "" };
  const referenceSource = sources.find((source) => source.key === reference.dataset);

  return (
    <div className="flex flex-col gap-4">
      <EditorHeader name={doc.name} domain={doc.domain} id={doc.id} canEdit={canEdit} canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} state={state} retry={retry} />
      <ViewTabs view={view} onChange={setView} />
      <Problems issues={issues} />
      {view === "yaml" ? (
        <YamlView kind="value_mapping" value={stored} issues={issues} disabled={disabled} label={t("yamlOf", { name: doc.name })} onApply={(spec) => change(() => open(spec as ValueMappingContent))} />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")} htmlFor="v-name">
              <Input id="v-name" value={doc.name} disabled={disabled} onChange={(event) => set({ name: event.target.value })} />
            </Field>
            <Field label={t("domain")} htmlFor="v-domain">
              <Select id="v-domain" value={doc.domain} disabled={disabled} onChange={(event) => set({ domain: event.target.value })}>
                {domains
                  .filter((domain) => !domain.retired || domain.code === doc.domain)
                  .map((domain) => (
                    <option key={domain.code} value={domain.code}>
                      {t("domainOption", { code: domain.code, name: domain.name })}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label={t("fromType")} htmlFor="v-from">
              <Input id="v-from" className="font-mono" value={doc.from_type} disabled={disabled} onChange={(event) => set({ from_type: event.target.value })} />
            </Field>
            <Field label={t("toType")} htmlFor="v-to">
              <Input id="v-to" className="font-mono" value={doc.to_type} disabled={disabled} onChange={(event) => set({ to_type: event.target.value })} />
            </Field>
            <Field label={t("default")} hint={t("defaultHint")} htmlFor="v-default">
              <Input id="v-default" className="font-mono" value={doc.default ?? ""} disabled={disabled} onChange={(event) => set({ default: event.target.value || undefined })} />
            </Field>
            <Field label={t("valuesFrom")} htmlFor="v-mode">
              <Select id="v-mode" value={doc.mode} disabled={disabled} onChange={(event) => set({ mode: event.target.value as Draft["mode"] })}>
                <option value="entries">{t("modeEntries")}</option>
                <option value="reference">{t("modeReference")}</option>
              </Select>
            </Field>
          </Card>

          {doc.mode === "entries" ? (
            <Card className="flex flex-col gap-3">
              <h2 className="text-sm font-bold">{t("entriesCount", { count: doc.rows.length, max: MAX_ENTRIES })}</h2>
              {duplicates > 0 ? <Alert tone="info">{t("duplicates", { count: duplicates })}</Alert> : null}
              {doc.rows.length > MAX_ENTRIES ? <Alert>{t("tooMany", { max: MAX_ENTRIES })}</Alert> : null}
              {doc.rows.length > 0 ? (
                <Table aria-label={t("entries")}>
                  <thead>
                    <tr>
                      <Th>{t("from")}</Th>
                      <Th>{t("to")}</Th>
                      <Th>
                        <span className="sr-only">{t("actions")}</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.rows.map((row, index) => (
                      <tr key={index} className={cn(duplicate[index] && "bg-warning/10")}>
                        <Td className="w-1/2">
                          <Input aria-label={t("fromOf", { n: index + 1 })} aria-invalid={duplicate[index] || undefined} className="font-mono" value={row.from} disabled={disabled} onChange={(event) => setRow(index, { from: event.target.value })} />
                          {duplicate[index] ? <span className="text-xs text-warning">{t("duplicate")}</span> : null}
                        </Td>
                        <Td className="w-1/2">
                          <Input aria-label={t("toOf", { n: index + 1 })} className="font-mono" value={row.to} disabled={disabled} onChange={(event) => setRow(index, { to: event.target.value })} />
                        </Td>
                        <Td>
                          {!disabled ? (
                            <Button variant="ghost" size="icon" aria-label={t("removeEntry", { n: index + 1 })} onClick={() => change((current) => ({ ...current, rows: current.rows.filter((_, position) => position !== index) }))}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          ) : null}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p className="text-sm text-muted">{t("noEntry")}</p>
              )}
              {!disabled ? (
                <>
                  <Button variant="secondary" size="sm" className="self-start" onClick={() => change((current) => ({ ...current, rows: [...current.rows, { from: "", to: "" }] }))}>
                    {t("addEntry")}
                  </Button>
                  <Field label={t("paste")} hint={t("pasteHint")} htmlFor="v-paste">
                    <Textarea id="v-paste" className="font-mono" rows={4} value={pasted} onChange={(event) => setPasted(event.target.value)} />
                  </Field>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    disabled={!pasted.trim()}
                    onClick={() => {
                      const rows = parsePasted(pasted);
                      change((current) => ({ ...current, rows: [...current.rows.filter((row) => row.from !== "" || row.to !== ""), ...rows] }));
                      setPasted("");
                    }}
                  >
                    {t("addPasted")}
                  </Button>
                </>
              ) : null}
            </Card>
          ) : (
            <Card className="grid gap-4 sm:grid-cols-3">
              <p className="text-xs text-muted sm:col-span-3">{t("referenceHint")}</p>
              <Field label={t("referenceDataset")} htmlFor="v-dataset">
                <Select id="v-dataset" value={reference.dataset} disabled={disabled} onChange={(event) => set({ reference: { dataset: event.target.value, key: "", value: "" } })}>
                  <option value="">{t("choose")}</option>
                  {sources.map((source) => (
                    <option key={source.key} value={source.key}>
                      {source.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("referenceKey")} htmlFor="v-key">
                <Select id="v-key" className="font-mono" value={reference.key} disabled={disabled || !referenceSource} onChange={(event) => set({ reference: { ...reference, key: event.target.value } })}>
                  <option value="">{t("choose")}</option>
                  {(referenceSource?.columns ?? []).map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("referenceValue")} htmlFor="v-value">
                <Select id="v-value" className="font-mono" value={reference.value} disabled={disabled || !referenceSource} onChange={(event) => set({ reference: { ...reference, value: event.target.value } })}>
                  <option value="">{t("choose")}</option>
                  {(referenceSource?.columns ?? []).map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </Select>
              </Field>
            </Card>
          )}
        </div>
        <WhereUsed uses={uses} />
      </div>
      )}
    </div>
  );
}
