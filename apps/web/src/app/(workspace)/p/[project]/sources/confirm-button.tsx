"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/errors";

/** A destructive action behind a confirmation that says what is lost and what stays restorable (UX-003). */
export function ConfirmButton({ label, title, body, action }: { label: string; title: string; body: string; action: () => Promise<ActionResult> }) {
  const t = useTranslations("Sources");
  const errors = useTranslations("Errors");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger">
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
            variant="danger"
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
  );
}
