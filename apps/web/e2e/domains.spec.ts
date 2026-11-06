import { expect, test } from "@playwright/test";
import { address, admin, cleanUp, PASSWORD, RUN, signIn } from "./support";

/** ADM-050…ADM-054: the Admin defines the organization's domains with an owner and stewards; retire and delete. */
const who = address("dom-admin");

test.beforeAll(async () => {
  const { data: org, error } = await admin.schema("licensing").from("organizations").insert({ name: `E2E ${RUN} Domains`, credits_granted: 2 }).select("id").single();
  if (error) throw error;
  const { data: user } = await admin.auth.admin.createUser({ email: who, password: PASSWORD, email_confirm: true });
  await admin.schema("app").from("memberships").insert({ organization_id: org.id, user_id: user.user!.id, role: "admin", email: who, display_name: "Dora Domains", joined_at: new Date().toISOString() });
});
test.afterAll(async () => cleanUp());

test("the Admin defines, retires and deletes domains (SCR-081)", async ({ page }) => {
  await signIn(page, who);
  await page.getByRole("link", { name: "Organization" }).click();
  await page.getByRole("navigation", { name: "Organization" }).getByRole("link", { name: "Domains" }).click();
  await expect(page.getByText("No domain yet")).toBeVisible();

  await page.getByRole("button", { name: "New domain" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code").fill("sel");
  await dialog.getByLabel("Name").fill("Sales");
  await dialog.getByLabel("Scope").fill("Customers, sales orders, invoicing.");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog.getByText("Choose at least one steward.")).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Dora Domains/ }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row", { name: /SEL/ });
  await expect(row).toContainText("Sales");
  await expect(row).toContainText("Active");

  await page.getByRole("button", { name: "New domain" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Code").fill("GOV");
  await dialog.getByLabel("Name").fill("Govern");
  await dialog.getByRole("checkbox", { name: /Dora Domains/ }).check();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await row.getByRole("button", { name: "Retire" }).click();
  await expect(row).toContainText("Retired");
  await page.getByRole("button", { name: "Delete GOV" }).click();
  await expect(page.getByRole("row", { name: /GOV/ })).toHaveCount(0);
});
