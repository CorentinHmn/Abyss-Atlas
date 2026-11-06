"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import type { ActionResult } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { acceptInvitation } from "./actions";

type Stage = { kind: "loading" } | { kind: "invalid" } | { kind: "ready"; email: string; name: string };

/** The invitation link carries a session in the address fragment (Supabase Auth); it is stored as cookies here. */
export function InviteForm({ minPassword }: { minPassword: number }) {
  const t = useTranslations("Invite");
  const errors = useTranslations("Errors");
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [state, action, pending] = useActionState<ActionResult, FormData>(acceptInvitation, null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access_token = fragment.get("access_token");
    const refresh_token = fragment.get("refresh_token");
    void (async () => {
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setStage({ kind: "invalid" });
      const { data: account } = await supabase.schema("app").from("memberships").select("display_name").eq("user_id", data.user.id).maybeSingle();
      setStage({ kind: "ready", email: data.user.email ?? "", name: account?.display_name ?? String(data.user.user_metadata.display_name ?? "") });
    })();
  }, []);

  if (stage.kind === "loading") return <p className="text-muted">{t("checking")}</p>;
  if (stage.kind === "invalid") return <Alert>{t("invalid")}</Alert>;
  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("intro", { email: stage.email })}</p>
      <Field label={t("name")} htmlFor="invite-name">
        <Input id="invite-name" name="name" defaultValue={stage.name} required maxLength={120} />
      </Field>
      <Field label={t("password")} hint={t("passwordRule", { min: minPassword })} htmlFor="invite-password">
        <Input id="invite-password" name="password" type="password" autoComplete="new-password" minLength={minPassword} required />
      </Field>
      <Field label={t("confirm")} htmlFor="invite-confirm">
        <Input id="invite-confirm" name="confirm" type="password" autoComplete="new-password" minLength={minPassword} required />
      </Field>
      {state && !state.ok ? <Alert>{errors(state.error)}</Alert> : null}
      <Button type="submit" disabled={pending}>
        {t("join")}
      </Button>
    </form>
  );
}
