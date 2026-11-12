"use client";

import type { Severity } from "@atlas/core";
import { Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SaveState } from "@/components/spec/use-spec-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SaveStatus } from "./models/[model]/model-editor";

export interface IssueView {
  code: string;
  severity: Severity;
  at: string;
  message: string;
}

export interface UseView {
  href: string;
  label: string;
}

const tone = (severity: Severity) => (severity === "error" ? "danger" : severity === "warning" ? "warning" : "info");

/** Title, undo / redo and the saving state of a rule or value mapping editor (MAP-070, MAP-072). */
export function EditorHeader(props: {
  name: string;
  domain: string;
  id: string;
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  state: SaveState;
  retry: () => void;
}) {
  const t = useTranslations("ModelEditor");
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{props.name}</h1>
        <Badge>{props.domain}</Badge>
        <span className="font-mono text-xs text-muted">{props.id}</span>
      </div>
      <div className="flex items-center gap-2">
        {props.canEdit ? (
          <>
            <Button variant="ghost" size="icon" aria-label={t("undo")} disabled={!props.canUndo} onClick={props.undo}>
              <Undo2 className="h-4 w-4" aria-hidden />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("redo")} disabled={!props.canRedo} onClick={props.redo}>
              <Redo2 className="h-4 w-4" aria-hidden />
            </Button>
            <SaveStatus state={props.state} onRetry={props.retry} />
          </>
        ) : (
          <Badge>{t("readOnly")}</Badge>
        )}
      </div>
    </div>
  );
}

export function Problems({ issues }: { issues: IssueView[] }) {
  const t = useTranslations("ModelEditor");
  if (issues.length === 0) return <p className="text-sm text-muted">{t("noProblem")}</p>;
  return (
    <details className="rounded-md border border-line bg-surface" open={issues.some((issue) => issue.severity === "error")}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-bold">{t("problemsCount", { count: issues.length })}</summary>
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto border-t border-line p-3" aria-label={t("problems")}>
        {issues.map((issue) => (
          <li key={issue.code + issue.at + issue.message} className="text-xs">
            <Badge tone={tone(issue.severity)}>{issue.code}</Badge> <span className="font-mono text-muted">{issue.at}</span> {issue.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** MAP-051: where a rule or value mapping is used. */
export function WhereUsed({ uses }: { uses: UseView[] }) {
  const t = useTranslations("Reusable");
  return (
    <Card className="flex flex-col gap-2 self-start">
      <h2 className="text-sm font-bold">{t("whereUsed")}</h2>
      {uses.length === 0 ? (
        <p className="text-sm text-muted">{t("notUsed")}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm" aria-label={t("whereUsed")}>
          {uses.map((use) => (
            <li key={use.href}>
              <Link href={use.href} className="text-brand hover:underline">
                {use.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
