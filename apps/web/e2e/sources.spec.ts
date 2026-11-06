import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { address, admin, cleanUp, PASSWORD, RUN, signIn } from "./support";

/**
 * P2, source registry (docs/05-modules/source-registry.md): systems, dictionary import from CSV and Excel with
 * preview, column grid, re-import that keeps what was written in Atlas, copy between projects, deletion.
 */
test.describe.configure({ mode: "serial" });

const editor = address("src-admin");
const organization = `E2E ${RUN} Sources`;
const fixtures = join(import.meta.dirname, "fixtures");

test.beforeAll(async () => {
  const { data: org, error } = await admin.schema("licensing").from("organizations").insert({ name: organization, credits_granted: 3 }).select("id").single();
  if (error) throw error;
  const { data: user, error: userError } = await admin.auth.admin.createUser({ email: editor, password: PASSWORD, email_confirm: true });
  if (userError) throw userError;
  const { error: membershipError } = await admin
    .schema("app")
    .from("memberships")
    .insert({ organization_id: org.id, user_id: user.user.id, role: "admin", email: editor, display_name: "Sam Sources", joined_at: new Date().toISOString() });
  if (membershipError) throw membershipError;
});
test.afterAll(async () => cleanUp());

test("a system is described and its dictionary imported from CSV, with a preview (SRC-001, SRC-020…SRC-024)", async ({ page }) => {
  await signIn(page, editor);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Reference sources");
  await page.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: /Reference sources/ }).click();
  await expect(page.getByText("Start with the sources")).toBeVisible();
  await page.getByRole("navigation", { name: "Project menu" }).getByRole("link", { name: "Sources" }).click();
  await expect(page.getByText("No system yet")).toBeVisible();

  await page.getByRole("button", { name: "New system" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("sap_fr");
  await dialog.getByLabel("Name").fill("SAP France");
  await dialog.getByLabel("Product").fill("SAP S/4HANA 2023");
  await dialog.getByLabel("Database").fill("RAW");
  await dialog.getByLabel("Schema", { exact: true }).fill("SAP_FR");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "SAP France" })).toBeVisible();

  await page.getByRole("link", { name: "Import a dictionary" }).click();
  await expect(page.getByRole("button", { name: "Copy the query" }).first()).toBeHidden(); // queries folded until opened
  await expect(page.getByLabel("Native types of")).toHaveValue("sap");
  await page.getByLabel("Dictionary file").setInputFiles(join(fixtures, "sap_fr_dictionary.csv"));
  await page.getByRole("button", { name: "Preview the import" }).click();
  const created = page.locator("dl").getByText("Datasets created").locator("..");
  await expect(created).toContainText("10");
  await page.getByRole("button", { name: "Import 10 datasets" }).click();
  await expect(page.getByText("10 datasets saved.")).toBeVisible();

  await page.getByRole("link", { name: "See the sources" }).click();
  await expect(page.getByRole("row")).toHaveCount(11);
  await page.getByRole("searchbox", { name: "Search tables and columns" }).fill("STCEG");
  await expect(page.getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "KNA1" })).toBeVisible();

  // Stored as the export file reads, keys in order (ARC-020).
  const { data } = await admin.schema("app").from("spec_objects").select("content, hash").eq("key", "sap_fr.kna1").single();
  expect(Object.keys(data?.content as object).slice(0, 4)).toEqual(["atlas", "kind", "id", "system"]);
  expect(data?.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
});

test("the column grid edits a dataset; a re-import keeps what was written in Atlas (SRC-012, SRC-023, IE-004)", async ({ page }) => {
  await signIn(page, editor);
  await page.goto("/projects");
  await page.getByRole("link", { name: /Reference sources/ }).click();
  await page.getByRole("navigation", { name: "Project menu" }).getByRole("link", { name: "Sources" }).click();
  await page.getByRole("link", { name: "KNA1" }).click();
  await expect(page.getByRole("heading", { name: "KNA1" })).toBeVisible();
  await expect(page.getByText("12 columns")).toBeVisible();

  const description = page.getByLabel("Column 3: description");
  await expect(page.getByLabel("Column 3: name")).toHaveValue("NAME1");
  await description.fill("Customer name, as agreed with the business");
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Add a column" }).click();
  await page.getByLabel("Column 13: name").fill("ZZ_LOYALTY");
  await page.getByLabel("Column 13: native type").fill("NUMC(4)");
  await expect(page.getByLabel("Column 13: Atlas type")).toHaveValue("string(4)"); // SRC-013, NUMC kept as text (IE-012)
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("13 columns")).toBeVisible();
  await expect(page.getByLabel("Column 3: description")).toHaveValue("Customer name, as agreed with the business");

  await page.goto(page.url().replace(/\/sap_fr\/kna1$/, "/import?system=sap_fr"));
  await page.getByLabel("Dictionary file").setInputFiles(join(fixtures, "sap_fr_dictionary.csv"));
  await page.getByRole("button", { name: "Preview the import" }).click();
  await expect(page.getByText("Kept, as they are not in the file")).toContainText("kna1.ZZ_LOYALTY");
  await page.getByRole("button", { name: /Import 10 datasets/ }).click();
  await expect(page.getByText(/saved\.|Nothing changed/)).toBeVisible();

  await page.getByRole("link", { name: "See the sources" }).click();
  await page.getByRole("link", { name: "KNA1" }).click();
  await expect(page.getByLabel("Column 3: description")).toHaveValue("Customer name, as agreed with the business");
  await expect(page.getByText("13 columns")).toBeVisible();
});

test("an Excel dictionary imports from the sheet the user picks (SRC-021, Q-SRC-01)", async ({ page }) => {
  await signIn(page, editor);
  await page.goto("/projects");
  await page.getByRole("link", { name: /Reference sources/ }).click();
  await page.getByRole("navigation", { name: "Project menu" }).getByRole("link", { name: "Sources" }).click();
  await page.getByRole("button", { name: "New system" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Identifier").fill("mes");
  await dialog.getByLabel("Name").fill("MES");
  await dialog.getByLabel("Kind").selectOption("mes");
  await dialog.getByLabel("Product").fill("Manufacturing execution system (SQL Server)");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await page.goto(page.url().replace(/\/sources(\?.*)?$/, "/sources/import?system=mes"));
  await expect(page.getByLabel("Native types of")).toHaveValue("sqlserver");
  await page.getByLabel("Dictionary file").setInputFiles(join(fixtures, "mes_dictionary.xlsx"));
  await page.getByLabel("Sheet").selectOption({ label: "Dictionary" });
  await page.getByRole("button", { name: "Preview the import" }).click();
  await expect(page.locator("dl").getByText("Datasets created").locator("..")).toContainText("1");
  await page.getByRole("button", { name: /Import 1 dataset/ }).click();
  await expect(page.getByText("1 dataset saved.")).toBeVisible();
});

test("systems are copied into another project, and a copied dataset can be deleted (SRC-005, SRC-031)", async ({ page }) => {
  await signIn(page, editor);
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Second project");
  await page.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: /Second project/ }).click();
  await page.getByRole("navigation", { name: "Project menu" }).getByRole("link", { name: "Sources" }).click();
  await page.getByRole("button", { name: "Copy from another project" }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: /SAP France/ }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Copy" }).click();
  await expect(page.getByRole("heading", { name: "SAP France" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(11);

  await page.getByRole("link", { name: "KNA1" }).click();
  await expect(page.getByLabel("Column 3: description")).toHaveValue("Customer name, as agreed with the business");
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/sources\?system=sap_fr$/);
  await expect(page.getByRole("row")).toHaveCount(10);

  const { data } = await admin.schema("app").from("spec_versions").select("change, content").eq("key", "sap_fr.kna1").order("id");
  expect(data?.map((version) => version.change)).toContain("delete"); // VER-004: restorable from the history
});
