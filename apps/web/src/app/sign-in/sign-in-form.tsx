"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { signIn, type SignInState } from "../actions";

export function SignInForm() {
  const t = useTranslations("SignIn");
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, null);

  return (
    <form action={action} className="flex flex-col gap-4">
      <label htmlFor="email" className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-line bg-transparent px-3 py-2 text-base font-normal"
        />
      </label>
      <label htmlFor="password" className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-line bg-transparent px-3 py-2 text-base font-normal"
        />
      </label>
      {state?.error ? (
        <p role="alert" className="text-sm text-danger">
          {t(state.error)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 font-semibold text-paper disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
