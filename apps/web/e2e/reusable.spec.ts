import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { contentHash, specKey, specPath, specToFile } from "@atlas/core";
import { parse } from "yaml";
import { address, admin, cleanUp, PASSWORD, RUN, signIn } from "./support";

/**
 * P2, mapping editor, steps 4 and 5 (docs/05-modules/mapping-editor.md MAP-024…MAP-026, MAP-050…MAP-052, MAP-060…MAP-062):
 * business rules and value mappings written in their screens and used by a model, its branches consolidated, its
 * columns checked; the YAML view of each object and the SQL preview of the model.
 */
test.describe.configure({ mode: "serial" });

const who = address("rules-admin");
const reference = join(import.meta.dirname, "../../../examples/reference");

/** A model with two branches and no consolidation yet (VAL-030). */
const site = {
  atlas: 1,
  kind: "model",
  id: "dim_site",
  name: "Site",
  domain: "GOV",
  description: "One row per site of the group.",
  grain: { description: "One site.", key: ["site_id"] },
  branches: { sap_fr: { datasets: [{ t: "sap_fr.t001w" }] }, sap_de: { datasets: [{ t: "sap_fr.t001w" }] } },
  columns: {
    site_id: { definition: "Group-wide site identifier.", type: "string(52)", nullable: false, key: true, from: { "*": "t.WERKS" } },
    plant_code: { definition: "Plant code in its ERP.", type: "string(4)", nullable: false, from: { "*": "t.WERKS" } },
    country: { definition: "ISO country of the site.", type: "string(3)", nullable: true, from: { "*": "t.LAND1" } },
  },
};

test.beforeAll(async () => {
  const { data: org, error } = await admin.schema("licensing").from("organizations").insert({ name: `E2E ${RUN} Rules`, credits_granted: 2 }).select("id").single();
  if (error) throw error;
  const { data: user } = await admin.auth.admin.createUser({ email: who, password: PASSWORD, email_confirm: true });
  await admin.schema("app").from("memberships").insert({ organization_id: org.id, user_id: user.user!.id, role: "admin", email: who, display_name: "Rita Rules", joined_at: new Date().toISOString() });
  await admin.schema("app").from("domains").insert({ organization_id: org.id, code: "GOV", name: "Govern", owner_email: who, steward_emails: [who] });
  const { data: project } = await admin.schema("app").from("projects").insert({ organization_id: org.id, name: "Sites", slug: "sites" }).select("id").single();
  const objects: [string, Record<string, unknown>][] = [
    ["system", parse(readFileSync(join(reference, "systems/sap_fr/system.yaml"), "utf8"), { version: "1.2" }) as Record<string, unknown>],
    ["dataset", parse(readFileSync(join(reference, "systems/sap_fr/datasets/t001w.yaml"), "utf8"), { version: "1.2" }) as Record<string, unknown>],
    ["model", site],
  ];
  for (const [kind, content] of objects) {
    const { error: insertError } = await admin.schema("app").from("spec_objects").insert({
      project_id: project!.id,
      organization_id: org.id,
      kind: kind as "model",
      key: specKey(kind as "model", content),
      path: specPath(kind as "model", content),
      content,
      hash: await contentHash(content),
    });
    if (insertError) throw insertError;
  }
});
test.afterAll(async () => cleanUp());

async function stored(key: string) {
  const { data } = await admin.schema("app").from("spec_objects").select("content").eq("key", key).single();
  return data?.content as Record<string, unknown>;
}

test("a business rule is written with its parameters and logic, and used in a mapping (MAP-050, MAP-051)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/sites/rules");
  await expect(page.getByText("No business rule yet")).toBeVisible();
  await page.getByRole("button", { name: "New business rule" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("qualified_key");
  await dialog.getByLabel("Name").fill("Key qualified by its system");
  await dialog.getByLabel("Statement").fill("A key unique in one ERP is prefixed with the code of its system.");
  await dialog.getByLabel("Returns (type)").fill("string(52)");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/p\/sites\/rules\/qualified_key$/);

  await page.getByLabel("Name of parameter 1").fill("system_code");
  await page.getByLabel("Type of parameter 1").fill("string(10)");
  await page.getByRole("button", { name: "Add a parameter" }).click();
  await page.getByLabel("Name of parameter 2").fill("local_key");
  await page.getByLabel("Type of parameter 2").fill("string(40)");
  await page.getByRole("button", { name: "Remove Logic, step 1 (Copy)" }).click();
  await page.getByLabel("Logic: kind of step to add").selectOption("concat");
  await page.getByRole("button", { name: "Add the step" }).click();
  const step = "Logic, step 1 (Concatenate)";
  await page.getByLabel(`${step}, part 1: kind of operand`).selectOption("param");
  await page.getByLabel(`${step}, part 1`, { exact: true }).selectOption("system_code");
  await page.getByLabel(`${step}, part 2`, { exact: true }).fill(":");
  await page.getByRole("button", { name: "Add a part" }).click();
  await page.getByLabel(`${step}, part 3: kind of operand`).selectOption("param");
  await page.getByLabel(`${step}, part 3`, { exact: true }).selectOption("local_key");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await expect(page.getByText("No problem found")).toBeVisible();

  const rule = await stored("qualified_key");
  expect(rule).toEqual({
    atlas: 1,
    kind: "rule",
    id: "qualified_key",
    name: "Key qualified by its system",
    domain: "GOV",
    statement: "A key unique in one ERP is prefixed with the code of its system.",
    parameters: { system_code: "string(10)", local_key: "string(40)" },
    returns: "string(52)",
    logic: [{ concat: { parts: [{ param: "system_code" }, { value: ":" }, { param: "local_key" }] } }],
  });

  // Used by the key of dim_site in the SAP France branch.
  await page.goto("/p/sites/models/dim_site");
  await page.getByRole("tab", { name: "Mappings" }).click();
  await page.getByRole("table", { name: "Mapping matrix" }).getByRole("button", { name: "site_id in sap_fr" }).click();
  await page.getByRole("checkbox", { name: "Same mapping for all branches" }).uncheck();
  const panel = page.getByRole("region", { name: "site_id in sap_fr" });
  await panel.getByLabel("site_id in sap_fr: kind").selectOption("steps");
  await panel.getByLabel("site_id in sap_fr: inputs").fill("");
  await panel.getByLabel("site_id in sap_fr: inputs").blur();
  await panel.getByLabel("site_id in sap_fr: kind of step to add").selectOption("rule");
  await panel.getByRole("button", { name: "Add the step" }).click();
  const ruleStep = "site_id in sap_fr, step 1 (Business rule)";
  await panel.getByLabel(`${ruleStep}: rule`).selectOption("qualified_key");
  await panel.getByLabel(`${ruleStep}, parameter system_code: kind of operand`).selectOption("value");
  await panel.getByLabel(`${ruleStep}, parameter system_code`, { exact: true }).fill("SAP_FR");
  await panel.getByLabel(`${ruleStep}, parameter local_key`, { exact: true }).fill("t.WERKS");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  const model = (await stored("dim_site")) as typeof site;
  expect((model.columns.site_id.from as Record<string, unknown>).sap_fr).toEqual({
    steps: [{ rule: { id: "qualified_key", args: { system_code: { value: "SAP_FR" }, local_key: "t.WERKS" } } }],
  });

  await page.goto("/p/sites/rules/qualified_key");
  await expect(page.getByRole("list", { name: "Where used" })).toContainText("Site (dim_site)");
});

test("a value mapping is filled by pasting from a spreadsheet, duplicates flagged, and used by a step (MAP-052)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/sites/value-mappings");
  await page.getByRole("button", { name: "New value mapping" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("country_iso");
  await dialog.getByLabel("Name").fill("SAP country to ISO country");
  await dialog.getByLabel("Source type").fill("string(3)");
  await dialog.getByLabel("Target type").fill("string(2)");
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/p\/sites\/value-mappings\/country_iso$/);

  await page.getByLabel("Paste from a spreadsheet").fill("FR\tFR\nDE\tDE\nGB;UK\nFR\tXX");
  await page.getByRole("button", { name: "Add the pasted entries" }).click();
  await expect(page.getByLabel("Source value 3")).toHaveValue("GB");
  await expect(page.getByLabel("Target value 3")).toHaveValue("UK");
  await expect(page.getByText("1 source value appears more than once")).toBeVisible();
  await page.getByRole("button", { name: "Remove entry 4" }).click();
  await expect(page.getByText(/appears more than once/)).toBeHidden();
  await page.getByLabel("Target value 3").fill("GB");
  await page.getByLabel("Default value").fill("ZZ");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  expect(await stored("country_iso")).toEqual({
    atlas: 1,
    kind: "value_mapping",
    id: "country_iso",
    name: "SAP country to ISO country",
    domain: "GOV",
    from_type: "string(3)",
    to_type: "string(2)",
    entries: { FR: "FR", DE: "DE", GB: "GB" },
    default: "ZZ",
  });

  // Used by the country column, and listed with its use.
  await page.goto("/p/sites/models/dim_site");
  await page.getByRole("tab", { name: "Mappings" }).click();
  await page.getByRole("table", { name: "Mapping matrix" }).getByRole("button", { name: "country in sap_fr" }).click();
  const panel = page.getByRole("region", { name: "country in All branches" });
  await panel.getByLabel("country in All branches: kind").selectOption("steps");
  await panel.getByLabel("country in All branches: kind of step to add").selectOption("map_values");
  await panel.getByRole("button", { name: "Add the step" }).click();
  await panel.getByLabel("country in All branches, step 1 (Translate codes (value mapping)): value mapping").fill("country_iso");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await page.goto("/p/sites/value-mappings");
  await expect(page.getByRole("row", { name: /country_iso/ })).toContainText("string(3) → string(2)");
  await expect(page.getByRole("row", { name: /country_iso/ })).toContainText("1");
});

test("the branches are consolidated and the columns checked (MAP-024, MAP-025)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/sites/models/dim_site");
  await expect(page.getByText("VAL-030")).toBeVisible();
  await page.getByRole("tab", { name: "Consolidation" }).click();
  await page.getByRole("button", { name: "Add a consolidation" }).click();
  await page.getByRole("checkbox", { name: "plant_code" }).check();
  await page.getByRole("button", { name: "Move sap_de up in Branch priority" }).click();
  await page.getByLabel("Override a column…").selectOption("country");
  await expect(page.getByLabel("Strategy for country")).toHaveValue("first_not_null");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await expect(page.getByText("VAL-030")).toBeHidden();

  await page.getByRole("tab", { name: "Checks" }).click();
  await expect(page.getByText("The grain key (site_id) is checked as not null and unique")).toBeVisible();
  await page.getByLabel("country: kind of check to add").selectOption("accepted_values");
  await page.getByRole("button", { name: "Add a check" }).nth(3).click();
  await page.getByRole("button", { name: "Use a value mapping" }).click();
  await page.getByLabel("country, check 1: value mapping").selectOption("country_iso");
  await page.getByLabel("country, check 1: severity").selectOption("warn");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });

  const model = await stored("dim_site");
  expect(model.consolidation).toEqual({
    combine: "union_all",
    add_source_column: "source_system",
    match: ["plant_code"],
    survivorship: { priority: ["sap_de", "sap_fr"], columns: { country: { strategy: "first_not_null" } } },
  });
  expect((model.columns as Record<string, { quality?: unknown }>).country?.quality).toEqual([{ accepted_values: { mapping: "country_iso", severity: "warn" } }]);
});

/** The text shown in the Monaco editor (it draws spaces as non-breaking spaces). */
async function editorText(page: Page): Promise<string> {
  return (await page.locator(".monaco-editor .view-lines").first().innerText()).replace(/\u00a0/g, " ");
}

/** Replaces the whole file, as a paste would (no auto-indent). */
async function replaceText(page: Page, text: string) {
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.evaluate((content) => {
    const data = new DataTransfer();
    data.setData("text/plain", content);
    document.activeElement?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, text);
}

test("the YAML view shows the export file, refuses an invalid edit and applies a valid one (MAP-060…MAP-062)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/sites/rules/qualified_key");
  await page.getByRole("tab", { name: "YAML" }).click();
  await expect.poll(() => editorText(page)).toContain("kind: rule");
  const file = specToFile("rule", await stored("qualified_key")).content;
  expect(await editorText(page)).toContain("system_code: string(10)");

  await replaceText(page, file.replace("returns: string(52)", "returns: string(52)\ncolour: red"));
  await expect(page.getByText("Not applied yet")).toBeVisible();
  await expect(page.getByRole("list", { name: "Problems in the YAML" })).toContainText("VAL-012");
  await expect(page.getByRole("list", { name: "Problems in the YAML" })).toContainText("Line 11");

  await replaceText(page, file.replace("name: Key qualified by its system", "name: Group key qualified by its system"));
  await expect(page.getByRole("list", { name: "Problems in the YAML" })).toBeHidden();
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await page.getByRole("tab", { name: "Form" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Group key qualified by its system");
  expect((await stored("qualified_key")).name).toBe("Group key qualified by its system");

  // A form edit reaches the YAML.
  await page.getByLabel("Returns (type)").fill("string(51)");
  await page.getByRole("tab", { name: "YAML" }).click();
  await expect.poll(() => editorText(page)).toContain("returns: string(51)");
});

test("the model's YAML and SQL tabs follow its changes (MAP-026, MAP-060)", async ({ page }) => {
  await signIn(page, who);
  await page.goto("/p/sites/models/dim_site");
  await page.getByRole("tab", { name: "SQL" }).click();
  await expect.poll(() => editorText(page)).toContain("branch_sap_de as (");
  expect(await editorText(page)).toContain("Generated by Atlas");

  await page.getByRole("tab", { name: "YAML" }).click();
  await expect.poll(() => editorText(page)).toContain("kind: model");
  const file = specToFile("model", await stored("dim_site")).content;
  await replaceText(page, file.replace("name: Site", "name: Site of the group"));
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "Site of the group" })).toBeVisible();
  expect((await stored("dim_site")).name).toBe("Site of the group");

  // A model with errors shows them instead of the SQL.
  await page.getByRole("tab", { name: "Mappings" }).click();
  await page.getByRole("table", { name: "Mapping matrix" }).getByRole("button", { name: "plant_code in sap_fr" }).click();
  await page.getByLabel("plant_code in All branches: kind").selectOption("empty");
  await expect(page.getByRole("status")).toHaveText("Saved", { timeout: 10_000 });
  await page.getByRole("tab", { name: "SQL" }).click();
  await expect(page.getByText("The SQL appears once these errors are fixed")).toBeVisible();
  await expect(page.getByRole("list", { name: "Errors that prevent generation" })).toContainText("plant_code");
});
