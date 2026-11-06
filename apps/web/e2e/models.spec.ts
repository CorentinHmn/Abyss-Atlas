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
  for (const [kind, file] of [
    ["system", "systems/sap_fr/system.yaml"],
    ["dataset", "systems/sap_fr/datasets/t001w.yaml"],
    ["dataset", "systems/sap_fr/datasets/kna1.yaml"],
    ["dataset", "systems/sap_fr/datasets/knvv.yaml"],
  ] as const) {
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

test("a branch reads two datasets joined on proposed keys, filtered and deduplicated (MAP-022, MAP-030…MAP-032, MAP-044)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/plants/models");
  await page.getByRole("button", { name: "New model" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("dim_customer");
  await dialog.getByLabel("Name").fill("Customer");
  await dialog.getByLabel("Description").fill("One row per customer of the group.");
  await dialog.getByLabel("Grain").fill("One customer.");
  await dialog.getByLabel("Start from").selectOption({ label: "SAP France › KNA1" });
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/models\/dim_customer$/);

  await page.getByRole("tab", { name: "Branches" }).click();
  await expect(page.getByLabel("Branch sap_fr, dataset 1: source")).toHaveValue("sap_fr.kna1");
  await page.getByRole("button", { name: "Add a dataset" }).click();
  await page.getByLabel("Branch sap_fr, dataset 2: source").selectOption("sap_fr.knvv");
  await expect(page.getByLabel("Branch sap_fr, dataset 2: alias")).toHaveValue("a");

  await page.getByRole("button", { name: "Add a join" }).click();
  await page.getByLabel("Branch sap_fr, join 1: right").selectOption("a");
  await page.getByLabel("Branch sap_fr, join 1: cardinality").selectOption("one_to_many");
  await page.getByRole("button", { name: "Propose the key columns" }).click();
  await expect(page.getByLabel("Branch sap_fr, join 1 1: left", { exact: true })).toHaveValue("s.MANDT");
  await expect(page.getByLabel("Branch sap_fr, join 1 2: right", { exact: true })).toHaveValue("a.KUNNR");
  await page.getByRole("button", { name: "Add a comparison" }).first().click();
  await page.getByLabel("Branch sap_fr, join 1 3: left", { exact: true }).fill("a.VKORG");
  await page.getByLabel("Branch sap_fr, join 1 3: right: kind of operand").selectOption("value");
  await page.getByLabel("Branch sap_fr, join 1 3: right", { exact: true }).fill("FR01");

  await page.getByRole("button", { name: "Add a filter" }).click();
  await page.getByLabel("Filter of branch sap_fr: left", { exact: true }).fill("s.KTOKD");
  await page.getByLabel("Filter of branch sap_fr: operator").selectOption("in");
  await page.getByLabel("Filter of branch sap_fr: values").fill("0001, 0002");
  await page.getByLabel("Filter of branch sap_fr: values").blur();

  await page.getByRole("button", { name: "Add a deduplication" }).click();
  await page.getByLabel("Branch sap_fr: deduplication key").fill("s.KUNNR");
  await page.getByLabel("Branch sap_fr: deduplication order").fill("a.VTWEG asc, a.SPART asc");
  await page.getByLabel("Branch sap_fr: deduplication order").blur();
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });

  const { data } = await admin.schema("app").from("spec_objects").select("content").eq("key", "dim_customer").single();
  const branch = (data?.content as { branches: Record<string, Record<string, unknown>> }).branches.sap_fr as Record<string, unknown>;
  expect(Object.keys(branch)).toEqual(["label", "source_tag", "datasets", "joins", "filter", "deduplicate"]);
  expect(branch.datasets).toEqual([{ s: "sap_fr.kna1" }, { a: "sap_fr.knvv" }]);
  expect(branch.joins).toEqual([
    {
      left: "s",
      right: "a",
      type: "left",
      condition: {
        all: [
          { left: "s.MANDT", op: "eq", right: "a.MANDT" },
          { left: "s.KUNNR", op: "eq", right: "a.KUNNR" },
          { left: "a.VKORG", op: "eq", right: { value: "FR01" } },
        ],
      },
      cardinality: "one_to_many",
    },
  ]);
  expect(branch.filter).toEqual({ left: "s.KTOKD", op: "in", values: ["0001", "0002"] });
  expect(branch.deduplicate).toEqual({ key: ["s.KUNNR"], keep: "first", order_by: [{ column: "a.VTWEG", direction: "asc" }, { column: "a.SPART", direction: "asc" }] });
});
