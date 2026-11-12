"use client";

import { useTranslations } from "next-intl";
import { type CheckKind, type QualityCheck, QualityList } from "@/components/spec/quality-list";
import { Card } from "@/components/ui/card";
import type { ModelContent, TargetColumn } from "@/lib/model";

const COLUMN_KINDS: CheckKind[] = ["not_null", "unique", "accepted_values", "relationship"];
const MODEL_KINDS: CheckKind[] = ["unique_combination", "relationship"];

/** MAP-025, MM-101: quality checks of the model and its columns; the grain's checks are automatic. */
export function ChecksTab({
  model,
  change,
  valueMappings,
  references,
  disabled,
}: {
  model: ModelContent;
  change: (update: (current: ModelContent) => ModelContent) => void;
  valueMappings: string[];
  references: string[];
  disabled: boolean;
}) {
  const t = useTranslations("Quality");
  const columns = Object.keys(model.columns);
  const setColumn = (name: string, quality: QualityCheck[]) =>
    change((current) => ({
      ...current,
      columns: { ...current.columns, [name]: { ...current.columns[name], quality: quality.length ? quality : undefined } as TargetColumn },
    }));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro")}</p>
      <Card className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">{t("automatic")}</h3>
        <p className="text-sm">{model.grain.key.length ? t("automaticBody", { keys: model.grain.key.join(", ") }) : t("noKey")}</p>
      </Card>
      <Card className="flex flex-col gap-3">
        <h3 className="text-sm font-bold">{t("modelChecks")}</h3>
        <QualityList
          checks={(model.quality as QualityCheck[] | undefined) ?? []}
          kinds={MODEL_KINDS}
          columns={columns}
          valueMappings={valueMappings}
          references={references}
          disabled={disabled}
          label={t("modelLabel")}
          onChange={(quality) => change((current) => ({ ...current, quality: quality.length ? quality : undefined }))}
        />
      </Card>
      {Object.entries(model.columns).map(([name, column]) => (
        <Card key={name} className="flex flex-col gap-3">
          <h3 className="font-mono text-sm font-bold">
            {name} <span className="font-sans font-normal text-muted">{column.type}</span>
          </h3>
          <QualityList
            checks={(column.quality as QualityCheck[] | undefined) ?? []}
            kinds={COLUMN_KINDS}
            columns={columns}
            valueMappings={valueMappings}
            references={references}
            disabled={disabled}
            label={name}
            onChange={(quality) => setColumn(name, quality)}
          />
        </Card>
      ))}
    </div>
  );
}
