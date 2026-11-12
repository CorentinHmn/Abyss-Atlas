"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/errors";

/** VER-040, VER-041: a restore behind a confirmation; it never rewrites the past. */
export function RestoreButton({ label, title, body, action, disabled = false }: { label: string; title: string; body: string; action: () => Promise<ActionResult>; disabled?: boolean }) {
  const t = useTranslations("History");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" disabled={disabled}>
            {label}
          </Button>
        </DialogTrigger>
        <DialogContent title={title} description={body} closeLabel={t("close")}>
          {result && !result.ok ? <Alert>{errors(result.error)}</Alert> : null}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">{t("cancel")}</Button>
            </DialogClose>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const outcome = await action();
                  setResult(outcome);
                  if (outcome?.ok) setOpen(false);
                })
              }
            >
              {label}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {result?.ok ? <Alert tone="success">{t("restored")}</Alert> : null}
    </>
  );
}
