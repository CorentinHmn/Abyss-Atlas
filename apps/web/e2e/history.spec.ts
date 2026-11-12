import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { contentHash, specKey, specPath } from "@atlas/core";
import { createClient } from "@supabase/supabase-js";
import { parse } from "yaml";
import { address, admin, cleanUp, PASSWORD, RUN, signIn } from "./support";

/**
 * P2, versioning (docs/05-modules/versioning.md VER-010…VER-041): the timeline, a named version, two versions of an
 * object compared in business terms, an object restored, the whole project restored to a named version.
 */
test.describe.configure({ mode: "serial" });

const who = address("history-admin");
const reference = join(import.meta.dirname, "../../../examples/reference");
const read = (file: string) => parse(readFileSync(join(reference, file), "utf8"), { version: "1.2" }) as Record<string, unknown>;
let projectId = "";

/** Saves objects as the signed-in person would, so that the history records them. */
async function saveAsUser(kind: "rule" | "value_mapping", content: Record<string, unknown>) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await client.auth.signInWithPassword({ email: who, password: PASSWORD });
  const objects = [{ kind, key: specKey(kind, content), path: specPath(kind, content), content, hash: await contentHash(content) }];
  const { error } = await client.schema("app").rpc("save_spec_objects", { project: projectId, objects, what: "import" });
  if (error) throw error;
}

async function stored(key: string) {
  const { data } = await admin.schema("app").from("spec_objects").select("content").eq("project_id", projectId).eq("key", key).maybeSingle();
  return (data?.content as Record<string, unknown> | undefined) ?? null;
}

test.beforeAll(async () => {
  const { data: org, error } = await admin.schema("licensing").from("organizations").insert({ name: `E2E ${RUN} History`, credits_granted: 2 }).select("id").single();
  if (error) throw error;
  const { data: user } = await admin.auth.admin.createUser({ email: who, password: PASSWORD, email_confirm: true });
  await admin.schema("app").from("memberships").insert({ organization_id: org.id, user_id: user.user!.id, role: "admin", email: who, display_name: "Hilda History", joined_at: new Date().toISOString() });
  await admin.schema("app").from("domains").insert({ organization_id: org.id, code: "GOV", name: "Govern", owner_email: who, steward_emails: [who] });
  const { data: project } = await admin.schema("app").from("projects").insert({ organization_id: org.id, name: "Timeline", slug: "timeline" }).select("id").single();
  projectId = project!.id;
  await saveAsUser("rule", read("rules/GOV/qualified_key.yaml"));
  await saveAsUser("value_mapping", read("value-mappings/GOV/rate_type_sap.yaml"));
});
test.afterAll(async () => cleanUp());

test("a named version is created, an edit is compared in business terms and an older version restored (VER-010…VER-040)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/timeline/history");
  const timeline = page.getByRole("list", { name: "Changes" });
  await expect(timeline.getByRole("listitem")).toHaveCount(2);
  await expect(timeline).toContainText("Created");

  await page.getByRole("button", { name: "Name this version" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Release 1.0");
  await dialog.getByLabel("Description").fill("First delivery to the data team.");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("list", { name: "Named versions" })).toContainText("Release 1.0");

  // An edit in the rule editor, then its history from the editor (VER-012).
  await page.goto("/p/timeline/rules/qualified_key");
  await page.getByLabel("Name", { exact: true }).fill("Key qualified by its ERP");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await page.getByRole("link", { name: "Version history" }).click();
  await expect(page).toHaveURL(/history\?kind=rule&object=qualified_key/);
  await expect(timeline.getByRole("listitem")).toHaveCount(2);
  await expect(timeline.getByRole("listitem").first()).toContainText("Changed");
  await expect(timeline.getByRole("listitem").first()).toContainText("name changed");

  await timeline.getByRole("link", { name: "Version 1: qualified_key" }).click();
  await expect(page.getByRole("list", { name: "Changes" })).toContainText("name changed");
  await expect(page.getByRole("list", { name: "Changes" })).toContainText("Group-wide key qualified by its source system → Key qualified by its ERP");
  await expect(page.getByRole("group", { name: "YAML, before and after" })).toBeVisible();

  // VER-040: the first version restored; a new version is recorded.
  await page.getByRole("list", { name: "Versions of this object" }).getByRole("link").first().click();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore this version" }).click();
  await expect(page.getByText("Restored.")).toBeVisible();
  expect((await stored("qualified_key"))?.name).toBe("Group-wide key qualified by its source system");
  await page.goto("/p/timeline/history");
  await expect(timeline.getByRole("listitem").first()).toContainText("Restored");
});

test("the whole project is restored to a named version, after the list of changes (VER-022, VER-041)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/timeline/value-mappings/rate_type_sap");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/value-mappings$/);
  await saveAsUser("value_mapping", { ...read("value-mappings/GOV/rate_type_sap.yaml"), id: "rate_type_extra", name: "Extra rate types" });

  await page.goto("/p/timeline/history");
  await page.getByRole("list", { name: "Named versions" }).getByRole("link", { name: "Release 1.0" }).click();
  await expect(page.getByText("1 object added, 1 removed, none changed.")).toBeVisible();
  const since = page.getByRole("list", { name: "Changes since this version" });
  await expect(since).toContainText("rate_type_extra");
  await expect(since).toContainText("rate_type_sap");

  await page.getByRole("button", { name: "Restore the project to this version" }).click();
  await expect(page.getByRole("dialog")).toContainText("1 object will get back their state of that moment, and 1 object created since will be deleted.");
  await page.getByRole("dialog").getByRole("button", { name: "Restore the project to this version" }).click();
  await expect(page).toHaveURL(/history\?restored=Release/);
  await expect(page.getByText("The project was restored to Release 1.0.")).toBeVisible();
  expect(await stored("rate_type_sap")).not.toBeNull();
  expect(await stored("rate_type_extra")).toBeNull();
  const latest = page.getByRole("list", { name: "Changes" }).getByRole("listitem");
  await expect(latest.first()).toContainText("Deleted");
  await expect(latest.nth(1)).toContainText("Restored");
});
