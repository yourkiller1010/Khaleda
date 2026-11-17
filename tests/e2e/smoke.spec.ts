import { expect, test } from "@playwright/test";

test.describe("public platform", () => {
  test("renders the enterprise landing experience and security boundary", async ({ page }) => {
    await page.goto("/en");
    await expect(page).toHaveTitle(/KillByte/);
    await expect(page.getByRole("heading", { name: /Precision is\s+the new power\./ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Platinum network routes/ })).toBeVisible();
    await page.getByRole("link", { name: "Security & responsible use" }).click();
    await expect(page).toHaveURL(/\/en\/security$/);
    await expect(page.getByRole("heading", { name: "Trust is an engineering discipline." })).toBeVisible();
    await expect(page.getByText(/does not include attack, takedown, third-party denial-of-service/)).toBeVisible();
  });

  test("serves a database-enabled RTL locale", async ({ page }) => {
    const response = await page.goto("/ar");
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("link", { name: /إنشاء حساب|Create account/ }).first()).toBeVisible();
  });
});

test.describe("authenticated workspace", () => {
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;
  test.skip(!email || !password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD against the test database.");

  test("signs in, loads live records, reaches administration, and uses authenticated chat", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The mutating real-time flow runs once on the desktop project.");
    await page.goto("/en/login");
    await page.getByLabel("Email or username").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: /Sign in securely/ }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Good to see you/ })).toBeVisible();

    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
    await expect(page.getByText("Database query batch")).toBeVisible();

    await page.goto("/en/chat");
    await expect(page.getByRole("heading", { name: "The registered-member community." })).toBeVisible();
    const body = `E2E live connection ${Date.now()}`;
    await page.getByPlaceholder("Write to the community…").fill(body);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(body)).toBeVisible();
  });
});
