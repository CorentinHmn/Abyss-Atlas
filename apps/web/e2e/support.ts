import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const secret = process.env.SUPABASE_SECRET_KEY;
if (!secret) throw new Error("Set SUPABASE_SECRET_KEY to the local secret key (supabase status).");

/** Local Supabase only: the tests create and remove their own people and organizations. */
export const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

export const RUN = Date.now().toString(36);
export const address = (who: string) => `e2e-${RUN}-${who}@atlas.test`;
export const PASSWORD = "correct-horse-battery";

export async function createOperator(email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("operator not created");
  const { error: insert } = await admin.schema("licensing").from("operators").insert({ user_id: data.user.id });
  if (insert) throw insert;
}

export async function cleanUp(): Promise<void> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const user of data?.users ?? []) if (user.email?.startsWith(`e2e-${RUN}-`)) await admin.auth.admin.deleteUser(user.id);
  // Projects first: their spec objects reference the organization too.
  const { data: organizations } = await admin.schema("licensing").from("organizations").select("id").like("name", `E2E ${RUN}%`);
  const ids = (organizations ?? []).map((organization) => organization.id);
  if (ids.length > 0) await admin.schema("app").from("projects").delete().in("organization_id", ids);
  await admin.schema("licensing").from("organizations").delete().like("name", `E2E ${RUN}%`);
}

function decodeQuotedPrintable(text: string): string {
  return text.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Latest e-mail sent to `email`: from Mailpit (CI) or from the folder of a local SMTP sink (MAIL_DIR). */
async function latestMail(email: string, after: number): Promise<string | null> {
  const folder = process.env.MAIL_DIR;
  if (folder) {
    const files = readdirSync(folder).filter((name) => name.endsWith(".eml") && Number(name.slice(0, -4)) / 1e6 >= after).sort();
    for (const name of files.reverse()) {
      const raw = decodeQuotedPrintable(readFileSync(join(folder, name), "utf8"));
      if (new RegExp(`^To:.*${email.replace(/[.+]/g, "\\$&")}`, "mi").test(raw)) return raw;
    }
    return null;
  }
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const found = (await search.json()) as { messages?: { ID: string; Created: string }[] };
  const message = found.messages?.find((item) => new Date(item.Created).getTime() >= after - 1000);
  if (!message) return null;
  const body = (await (await fetch(`${base}/api/v1/message/${message.ID}`)).json()) as { HTML?: string; Text?: string };
  return body.HTML ?? body.Text ?? null;
}

/** Waits for the e-mail and returns its Supabase Auth link. */
export async function linkFromMail(email: string, after: number): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const mail = await latestMail(email, after);
        link = mail?.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify[^"'\s<>]+/)?.[0]?.replace(/&amp;/g, "&");
        return Boolean(link);
      },
      { timeout: 15_000, message: `e-mail to ${email}` },
    )
    .toBe(true);
  return link as string;
}

export async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function signOut(page: Page, menuName: string | RegExp): Promise<void> {
  await page.getByRole("button", { name: menuName }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/(sign-in)?$/);
}
