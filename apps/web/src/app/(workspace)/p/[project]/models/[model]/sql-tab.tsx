"use client";

import { useTranslations } from "next-intl";
import { CodeEditor } from "@/components/code";
import { Badge } from "@/components/ui/badge";
import type { SqlPreview } from "@/lib/preview";

/** MAP-026: read-only preview of the generated dbt model, or the errors that prevent it. */
export function SqlTab({ preview, modelPath, saving }: { preview: SqlPreview | null; modelPath: string; saving: boolean }) {
  const t = useTranslations("Sql");
  if (!preview) return null;
  if ("sql" in preview) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{saving ? t("refreshing") : t("hint")}</p>
        <CodeEditor language="sql" label={t("label")} value={preview.sql} readOnly />
      </div>
    );
  }
  const own = preview.errors.filter((error) => error.file === modelPath);
  const others = preview.errors.filter((error) => error.file !== modelPath);
  return (
    <div className="flex flex-col gap-3" role="status">
      <p className="text-sm font-semibold">{t("blocked")}</p>
      <ul className="flex flex-col gap-1 text-xs" aria-label={t("errors")}>
        {[...own, ...others].map((error) => (
          <li key={`${error.file}${error.code}${error.at}${error.message}`}>
            <Badge tone="danger">{error.code}</Badge> {error.file !== modelPath ? <span className="font-mono text-muted">{error.file}</span> : null}{" "}
            <span className="font-mono text-muted">{error.at}</span> {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
