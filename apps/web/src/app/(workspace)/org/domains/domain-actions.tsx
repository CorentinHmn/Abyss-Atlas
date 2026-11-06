"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/errors";
import { deleteDomain, setRetired } from "./actions";

/** ADM-052: retire / reactivate, or delete when unused. */
export function DomainActions({ code, retired }: { code: string; retired: boolean }) {
  const t = useTranslations("Domains");
  const errors = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  const run = (action: () => Promise<ActionResult>) => startTransition(async () => setResult(await action()));
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => setRetired(code, !retired))}>
          {retired ? t("reactivate") : t("retire")}
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" disabled={pending} onClick={() => run(() => deleteDomain(code))} aria-label={t("deleteCode", { code })}>
          {t("delete")}
        </Button>
      </div>
      {result && !result.ok ? <Alert className="max-w-72 text-xs">{errors(result.error)}</Alert> : null}
    </div>
  );
}
