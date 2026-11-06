"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";

export interface DatasetRow {
  id: string;
  name: string;
  description: string;
  columns: string[];
  origin: string;
  errors: number;
  warnings: number;
}

/** SRC-010: datasets of a system, searched by name, description or column name. */
export function DatasetList({ href, datasets }: { href: string; datasets: DatasetRow[] }) {
  const t = useTranslations("Sources");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return datasets;
    return datasets.filter(
      (dataset) =>
        dataset.name.toLowerCase().includes(q) ||
        dataset.description.toLowerCase().includes(q) ||
        dataset.columns.some((column) => column.toLowerCase().includes(q)),
    );
  }, [datasets, query]);
  return (
    <div className="flex flex-col gap-3">
      <Input type="search" placeholder={t("search")} aria-label={t("search")} value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-sm" />
      <Table>
        <thead>
          <tr>
            <Th>{t("datasetName")}</Th>
            <Th>{t("description")}</Th>
            <Th className="text-right">{t("columns")}</Th>
            <Th>{t("origin")}</Th>
            <Th>{t("problems")}</Th>
          </tr>
        </thead>
        <tbody>
          {shown.map((dataset) => (
            <tr key={dataset.id}>
              <Td className="whitespace-nowrap">
                <Link href={`${href}/${dataset.id}`} className="font-medium text-brand hover:underline">
                  {dataset.name}
                </Link>
              </Td>
              <Td className="w-full max-w-0 truncate text-muted">{dataset.description}</Td>
              <Td className="text-right tabular-nums">{dataset.columns.length}</Td>
              <Td className="whitespace-nowrap text-muted">{dataset.origin}</Td>
              <Td className="whitespace-nowrap">
                {dataset.errors > 0 ? <Badge tone="danger">{t("errorCount", { count: dataset.errors })}</Badge> : null}{" "}
                {dataset.warnings > 0 ? <Badge tone="warning">{t("warningCount", { count: dataset.warnings })}</Badge> : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {shown.length === 0 ? <p className="text-sm text-muted">{query ? t("noMatch") : t("noDataset")}</p> : null}
    </div>
  );
}
