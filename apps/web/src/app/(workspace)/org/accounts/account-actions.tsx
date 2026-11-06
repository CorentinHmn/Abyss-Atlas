"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/errors";
import type { Role } from "@/lib/session";
import { cancelDeletion, reactivateAccount, requestDeletion, resendInvitation, setRole, suspendAccount } from "./actions";

type Confirm = "suspend" | "delete" | null;

export function AccountActions({
  userId,
  name,
  role,
  status,
  invited,
  deletionRequested,
  isSelf,
}: {
  userId: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  invited: boolean;
  deletionRequested: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations("Accounts");
  const roles = useTranslations("Roles");
  const errors = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setResult(await action());
      setConfirm(null);
    });

  if (isSelf) return <span className="text-xs text-muted">{t("you")}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("actionsFor", { name })} disabled={pending}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {status === "active"
            ? (["admin", "editor", "viewer"] as const)
                .filter((option) => option !== role)
                .map((option) => (
                  <DropdownMenuItem key={option} onSelect={() => run(() => setRole(userId, option))}>
                    {t("makeRole", { role: roles(option) })}
                  </DropdownMenuItem>
                ))
            : null}
          {invited && status === "active" ? (
            <DropdownMenuItem onSelect={() => run(() => resendInvitation(userId))}>{t("resend")}</DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {status === "active" ? (
            <DropdownMenuItem onSelect={() => setConfirm("suspend")}>{t("suspend")}</DropdownMenuItem>
          ) : !deletionRequested ? (
            <DropdownMenuItem onSelect={() => run(() => reactivateAccount(userId))}>{t("reactivate")}</DropdownMenuItem>
          ) : null}
          {deletionRequested ? (
            <DropdownMenuItem onSelect={() => run(() => cancelDeletion(userId))}>{t("cancelDeletion")}</DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-danger" onSelect={() => setConfirm("delete")}>
              {t("requestDeletion")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {result && !result.ok ? <Alert className="max-w-64 text-xs">{errors(result.error)}</Alert> : null}
      {result?.ok && result.message ? <Alert tone="success" className="max-w-64 text-xs">{t(result.message)}</Alert> : null}
      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent
          title={confirm === "delete" ? t("deleteTitle", { name }) : t("suspendTitle", { name })}
          description={confirm === "delete" ? t("deleteBody") : t("suspendBody")}
          closeLabel={t("close")}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">{t("cancel")}</Button>
            </DialogClose>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run(() => (confirm === "delete" ? requestDeletion(userId) : suspendAccount(userId)))}
            >
              {confirm === "delete" ? t("requestDeletion") : t("suspend")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
