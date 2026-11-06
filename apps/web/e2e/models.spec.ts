import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { contentHash, specKey, specPath } from "@atlas/core";
import { parse } from "yaml";
import { address, admin, cleanUp, PASSWORD, RUN, signIn } from "./support";

/**
 * P2, mapping editor, step 1 (docs/05-modules/mapping-editor.md MAP-010…MAP-021, MAP-070, MAP-072): a model created
 * from a source dataset, its overview and target columns edited, saved automatically, undone.
 */
test.describe.configure({ mode: "serial" });

const who = address("model-admin");
const reference = join(import.meta.dirname, "../../../examples/reference");

test.beforeAll(async () => {
  const { data: org, error } = await admin.schema("licensing").from("organizations").insert({ name: `E2E ${RUN} Models`, credits_granted: 2 }).select("id").single();
  if (error) throw error;
  const { data: user } = await admin.auth.admin.createUser({ email: who, password: PASSWORD, email_confirm: true });
  await admin.schema("app").from("memberships").insert({ organization_id: org.id, user_id: user.user!.id, role: "admin", email: who, display_name: "Mona Models", joined_at: new Date().toISOString() });
  await admin.schema("app").from("domains").insert({ organization_id: org.id, code: "GOV", name: "Govern", owner_email: who, steward_emails: [who] });
  const { data: project } = await admin.schema("app").from("projects").insert({ organization_id: org.id, name: "Plants", slug: "plants" }).select("id").single();
  // The SAP France system and its plant table, as the source registry stores them.
  for (const [kind, file] of [["system", "systems/sap_fr/system.yaml"], ["dataset", "systems/sap_fr/datasets/t001w.yaml"]] as const) {
    const content = parse(readFileSync(join(reference, file), "utf8"), { version: "1.2" }) as Record<string, unknown>;
    const { error: insertError } = await admin.schema("app").from("spec_objects").insert({
      project_id: project!.id,
      organization_id: org.id,
      kind,
      key: specKey(kind, content),
      path: specPath(kind, content),
      content,
      hash: await contentHash(content),
    });
    if (insertError) throw insertError;
  }
});
test.afterAll(async () => cleanUp());

test("a model is created from a source dataset, edited and saved automatically (MAP-012, MAP-020, MAP-021, MAP-070)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/plants/models");
  await expect(page.getByText("No model yet")).toBeVisible();
  await page.getByRole("button", { name: "New model" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("dim_plant");
  await dialog.getByLabel("Name").fill("Plant");
  await dialog.getByLabel("Description").fill("One row per plant of the group.");
  await dialog.getByLabel("Grain").fill("One plant of the group.");
  await dialog.getByLabel("Start from").selectOption({ label: "SAP France › T001W" });
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/p\/plants\/models\/dim_plant$/);
  await expect(page.getByRole("heading", { name: "Plant" })).toBeVisible();
  await page.getByRole("tab", { name: "Columns" }).click();
  await expect(page.getByLabel("Column 2: name")).toHaveValue("werks");
  await expect(page.getByLabel("Column 2: type")).toHaveValue("string(4)");
  await expect(page.getByLabel("Column 2: part of the key")).toBeChecked();

  await page.getByLabel("Column 2: name").fill("plant_code");
  await page.getByLabel("Column 2: definition").fill("Plant code in its ERP.");
  await page.getByLabel("Column 1: name").click(); // leaving the field applies the rename
  await page.getByRole("button", { name: "Remove column 1" }).click(); // MANDT is not wanted in the target
  await expect(page.getByLabel("Column 1: name")).toHaveValue("plant_code");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByLabel("Layer").selectOption("mart");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });

  await page.reload();
  await page.getByRole("tab", { name: "Columns" }).click();
  await expect(page.getByLabel("Column 1: name")).toHaveValue("plant_code");
  await expect(page.getByLabel("Column 1: definition")).toHaveValue("Plant code in its ERP.");

  const { data } = await admin.schema("app").from("spec_objects").select("content").eq("key", "dim_plant").single();
  const content = data?.content as { grain: { key: string[] }; layer: string; columns: Record<string, { from: Record<string, string> }> };
  expect(Object.keys(content)).toEqual(["atlas", "kind", "id", "name", "domain", "description", "grain", "layer", "branches", "columns"]);
  expect(content.grain.key).toEqual(["plant_code"]); // the grain follows the key columns
  expect(content.layer).toBe("mart");
  expect(content.columns.plant_code?.from).toEqual({ sap_fr: "s.WERKS" }); // the mapping follows the renamed column
});

test("undo goes back over the user's own changes, and the model list shows it (MAP-010, MAP-072)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/plants/models/dim_plant");
  await page.getByRole("tab", { name: "Columns" }).click();
  await page.getByLabel("Column 2: definition").fill("Changed by mistake");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByLabel("Column 2: definition")).not.toHaveValue("Changed by mistake");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });

  await page.getByRole("navigation", { name: "Project menu" }).getByRole("link", { name: "Models" }).click();
  await expect(page).toHaveURL(/\/models$/);
  const row = page.getByRole("row", { name: /dim_plant/ });
  await expect(row).toContainText("1"); // one branch
  await expect(row).toContainText("100 %"); // every column is mapped in its only branch
});
