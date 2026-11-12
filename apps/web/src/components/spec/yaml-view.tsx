"use client";

import { checkSpecFile, type EditIssue, lineOf, type Severity, type SpecKind, specToFile } from "@atlas/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { CodeEditor, type Marker } from "@/components/code";
import { Badge } from "@/components/ui/badge";

export interface SavedIssue {
  code: string;
  severity: Severity;
  at: string;
  message: string;
}

/**
 * MAP-060…MAP-063: the object as its export file. An edit is applied to the document as soon as the YAML is valid
 * for its schema; until then the problems are listed and the forms keep the last valid state.
 */
export function YamlView({
  kind,
  value,
  onApply,
  disabled,
  issues,
  label,
}: {
  kind: SpecKind;
  /** The object in its stored form. */
  value: Record<string, unknown>;
  onApply: (spec: Record<string, unknown>) => void;
  disabled: boolean;
  /** Validation of the saved object. */
  issues: SavedIssue[];
  label: string;
}) {
  const t = useTranslations("Yaml");
  const serialized = useMemo(() => specToFile(kind, value).content, [kind, value]);
  const [shown, setShown] = useState({ text: serialized, source: serialized });
  const [focused, setFocused] = useState(false);
  // Changes from the forms, undo or the server reach the text while the user is not typing in it.
  if (!focused && serialized !== shown.source) setShown({ text: serialized, source: serialized });

  const check = (text: string): { spec?: Record<string, unknown>; issues: EditIssue[] } => {
    const result = checkSpecFile(text, kind);
    if (result.spec && result.spec.id !== value.id) return { issues: [{ code: "VAL-014", at: "id", message: t("idLocked", { id: String(value.id) }), line: lineOf(text, "id") }] };
    return result;
  };
  const local = useMemo(() => check(shown.text).issues, [shown.text]); // eslint-disable-line react-hooks/exhaustive-deps
  const inSync = shown.text === serialized;
  const markers: Marker[] = local.length
    ? local.map((issue) => ({ line: issue.line, message: `${issue.code} ${issue.message}`, severity: "error" }))
    : inSync
      ? issues.map((issue) => ({ line: lineOf(shown.text, issue.at), message: `${issue.code} ${issue.message}`, severity: issue.severity }))
      : [];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{disabled ? t("readOnly") : t("hint")}</p>
      <CodeEditor
        language="yaml"
        label={label}
        value={shown.text}
        readOnly={disabled}
        markers={markers}
        onFocusChange={setFocused}
        onChange={(text) => {
          setShown((current) => ({ ...current, text }));
          const result = check(text);
          if (result.spec) onApply(result.spec);
        }}
      />
      {local.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger/40 p-3 text-sm">
          <p className="font-semibold">{t("notApplied")}</p>
          <ul className="flex flex-col gap-1" aria-label={t("yamlProblems")}>
            {local.map((issue) => (
              <li key={`${issue.code}${issue.line}${issue.message}`} className="text-xs">
                <Badge tone="danger">{issue.code}</Badge> <span className="text-muted">{t("line", { line: issue.line })}</span> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
