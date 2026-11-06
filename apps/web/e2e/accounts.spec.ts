import { expect, test } from "@playwright/test";
import { address, cleanUp, createOperator, linkFromMail, PASSWORD, RUN, signIn, signOut } from "./support";

/**
 * P2, accounts and credits (docs/05-modules/administration.md, docs/05-modules/control-tower.md):
 * the operator creates an organization, its first Admin joins and invites a colleague, the last credit is refused,
 * a deletion validated by the operator gives the credit back, and a forgotten password can be reset.
 */
test.describe.configure({ mode: "serial" });

const operator = address("operator");
const firstAdmin = address("admin");
const editor = address("editor");
const organization = `E2E ${RUN} Acme`;

test.beforeAll(async () => createOperator(operator));
test.afterAll(async () => cleanUp());

test("the operator creates an organization and invites its first Admin (CT-011, CT-012)", async ({ page }) => {
  await signIn(page, operator);
  await expect(page).toHaveURL(/\/control$/);
  await page.getByRole("button", { name: "New organization" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(organization);
  await dialog.getByLabel("Credits granted").fill("2");
  await dialog.getByLabel("First Admin's name").fill("Ada Admin");
  await dialog.getByLabel("First Admin's e-mail").fill(firstAdmin);
  const sentAfter = Date.now();
  await dialog.getByRole("button", { name: "Create and invite" }).click();
  await expect(page.getByRole("heading", { name: organization })).toBeVisible();
  await expect(page.getByText("The organization was created, but")).toHaveCount(0);
  const figures = page.locator("dl");
  await expect(figures).toContainText("Accounts1");
  await expect(figures).toContainText("Remaining1");
  await expect(page.getByText(firstAdmin)).toHaveCount(0); // CT-012: the control tower does not show the e-mail
  await linkFromMail(firstAdmin, sentAfter);

  await page.goto("/control/audit");
  const rows = page.getByRole("row").filter({ hasText: organization });
  await expect(rows.filter({ hasText: "Organization created with 2 credits" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "First Admin invited" })).toHaveCount(1);
});

test("the first Admin joins and invites a colleague, until no credit remains (ADM-010…ADM-014)", async ({ page }) => {
  const link = await linkFromMail(firstAdmin, 0);
  await page.goto(link);
  await expect(page).toHaveURL(/\/invite/);
  await expect(page.getByLabel("Name")).toHaveValue("Ada Admin");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm the password").fill(PASSWORD);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByTestId("organization-name")).toHaveText(organization);

  await page.goto("/org/accounts");
  const counter = page.getByLabel("License counter");
  await expect(counter).toContainText("Credits granted2");
  await expect(counter).toContainText("Credits remaining1");

  await page.getByRole("button", { name: "New account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Eli Editor");
  await dialog.getByLabel("E-mail").fill(editor);
  await dialog.getByLabel("Role").selectOption("editor");
  const sentAfter = Date.now();
  await dialog.getByRole("button", { name: "Send the invitation" }).click();
  await expect(dialog).toBeHidden();
  const row = page.getByRole("row", { name: /Eli Editor/ });
  await expect(row).toContainText("Invited");
  await expect(counter).toContainText("Credits remaining0");
  await expect(page.getByRole("button", { name: "New account" })).toBeDisabled(); // ADM-011
  await linkFromMail(editor, sentAfter);

  await page.getByRole("link", { name: "Projects" }).click();
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Reference project");
  await page.getByRole("dialog").getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("link", { name: /Reference project/ })).toBeVisible();
});

test("the invited Editor joins and sees the organization's projects, not its administration", async ({ page }) => {
  await page.goto(await linkFromMail(editor, 0));
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm the password").fill(PASSWORD);
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("link", { name: /Reference project/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0);
  const response = await page.goto("/org/accounts");
  expect(response?.status()).toBe(404);
  expect((await page.goto("/control"))?.status()).toBe(404); // CT-001
  expect((await page.goto("/progress"))?.status()).toBe(404); // SCR-900
});

test("the Admin requests a deletion; the operator validates it and the credit comes back (ADM-020, CT-021)", async ({ page }) => {
  await signIn(page, firstAdmin);
  await page.goto("/org/accounts");
  await page.getByRole("button", { name: "Actions for Eli Editor" }).click();
  await page.getByRole("menuitem", { name: "Request deletion" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Request deletion" }).click();
  await expect(page.getByRole("row", { name: /Eli Editor/ })).toContainText("Waiting for deletion");
  await expect(page.getByLabel("License counter")).toContainText("Waiting for deletion1");
  await signOut(page, "Ada Admin");

  await signIn(page, operator);
  await page.getByRole("link", { name: organization }).click();
  await expect(page.getByText("1 account waits for deletion.")).toBeVisible();
  await page.getByRole("button", { name: "Validate the deletions" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Validate the deletions" }).click();
  await expect(page.getByText("1 account removed; its credit is back.")).toBeVisible();
  await page.reload();
  await expect(page.locator("dl")).toContainText("Remaining1");
  await expect(page.getByText("No account waits for deletion.")).toBeVisible();

  const { data } = await (await import("./support")).admin.auth.admin.listUsers({ perPage: 1000 });
  expect(data.users.some((user) => user.email === editor)).toBe(false); // ADM-023: the sign-in is removed too
});

test("a forgotten password is reset through an e-mail link (SCR-003)", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await page.getByLabel("E-mail").fill(firstAdmin);
  const sentAfter = Date.now();
  await page.getByRole("button", { name: "Send the link" }).click();
  await expect(page.getByText("If an account exists for this address")).toBeVisible();
  await page.goto(await linkFromMail(firstAdmin, sentAfter));
  await expect(page).toHaveURL(/\/reset-password\/new$/);
  const newPassword = `${PASSWORD}-2`;
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Confirm the password").fill(newPassword);
  await page.getByRole("button", { name: "Save and sign in" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await signOut(page, "Ada Admin");
  await signIn(page, firstAdmin, newPassword);
  await expect(page).toHaveURL(/\/projects$/);
});
