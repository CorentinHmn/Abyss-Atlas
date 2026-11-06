import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const t = await getTranslations("SignIn");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <SignInForm />
      <div className="flex justify-between text-sm">
        <Link href="/reset-password" className="text-brand hover:underline">
          {t("forgot")}
        </Link>
        <Link href="/" className="text-muted hover:text-ink">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
