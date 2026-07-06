import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for production UAT`);
  return value;
}

const tag = requiredEnvironment("UAT_TAG");
const organizationId = requiredEnvironment("UAT_ORGANIZATION_ID");
const saleId = requiredEnvironment("UAT_SALE_ID");
const customerId = requiredEnvironment("UAT_CUSTOMER_ID");
const email = `uat-${tag}-owner@bebshaniti.test`;

function apiEnvironment() {
  const content = readFileSync(path.join(process.cwd(), "apps/api/.env"), "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      }),
  );
}

const secrets = apiEnvironment();
const supabaseUrl = secrets.SUPABASE_URL;
const serviceRole = secrets.SUPABASE_SERVICE_ROLE_KEY;
let password = "";

async function resetOwnerPassword() {
  const headers = { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` };
  const listing = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers,
  });
  expect(listing.ok).toBeTruthy();
  const payload = (await listing.json()) as { users: Array<{ id: string; email?: string }> };
  const user = payload.users.find((candidate) => candidate.email === email);
  expect(user, `UAT owner ${email} must exist`).toBeTruthy();
  password = `Uat-${randomBytes(18).toString("base64url")}!9a`;
  const update = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user!.id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  expect(update.ok).toBeTruthy();
}

async function updateReceiptSize(size: "a4" | "80mm" | "58mm") {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/organizations?id=eq.${organizationId}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ receipt_size: size }),
    },
  );
  expect(response.ok).toBeTruthy();
}

async function expectNoRootOverflow(page: Page) {
  const overflowing = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflowing).toBeFalsy();
}

test.beforeAll(async () => {
  expect(process.env.UAT_ALLOW_PRODUCTION_MUTATIONS).toBe("I_UNDERSTAND");
  expect(supabaseUrl).toMatch(/^https:\/\//);
  expect(serviceRole.length).toBeGreaterThan(40);
  await resetOwnerPassword();
});

test("isolated production UI, i18n, responsive and print UAT", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    consoleErrors.push(`PAGE_ERROR ${error.stack ?? error.message}`);
  });
  page.on("requestfailed", (request) => {
    networkErrors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500)
      networkErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
  });

  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn-BD");
  await expect(page.getByRole("heading", { name: "লগইন", exact: true })).toBeVisible();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "লগইন", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড", exact: true })).toBeVisible();
  await expect
    .poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "organization_id")?.value)
    .toBe(organizationId);
  await expect(page.getByText("Failed to fetch", { exact: true })).toHaveCount(0);
  await expectNoRootOverflow(page);

  const language = page.locator(".topbar .language-switch select");
  await expect(language).toHaveCount(1);
  await language.selectOption("en");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();

  await page.goto("/products?add=1");
  await expect(page.getByRole("heading", { name: "Products", exact: true })).toBeVisible();
  await expect(page.locator("section.premium-form")).toBeVisible();
  const productSearch = page.locator(".suggestion-field input");
  await productSearch.fill("aci");
  await expect(page.locator(".suggestion-list button")).not.toHaveCount(0);
  await page.getByLabel("Buying price", { exact: true }).fill("100");
  await page.getByLabel("Selling price", { exact: true }).fill("90");
  await expect(page.locator(".price-warning")).toBeVisible();
  await expect(page.locator(".price-profit-card")).toContainText("Profit margin");
  await page.keyboard.press("Escape");
  await expect(page.locator("section.premium-form")).toHaveCount(0);
  await expectNoRootOverflow(page);

  await page.goto("/products/import");
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Sample CSV", exact: true })).toBeVisible();

  await page.goto("/sales/new");
  const posSearch = page.getByPlaceholder("Enter name, SKU or barcode", { exact: true });
  await expect(posSearch).toBeFocused();
  await posSearch.fill("UAT");
  await expect(page.locator(".pos-products button")).not.toHaveCount(0);
  await posSearch.press("Enter");
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await expectNoRootOverflow(page);

  await page.goto("/reports");
  await expect(page.getByText("Profit summary", { exact: true })).toBeVisible();
  await expect(page.getByText("Best-selling products", { exact: true })).toBeVisible();
  if (testInfo.project.name === "chrome-desktop") {
    const exportButton = page.getByRole("button", { name: "Export CSV", exact: true });
    await expect(exportButton).toBeEnabled();
    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();
    await downloadPromise;
  }

  await page.goto(`/customers/${customerId}`);
  await expect(page.locator("article.customer-statement")).toBeVisible();
  await expect(page.getByText("Opening balance", { exact: true })).toBeVisible();
  const receiptCheckbox = page.locator('.statement-toolbar input[type="checkbox"]');
  await receiptCheckbox.check();
  await expect(page.locator("article.customer-statement")).toHaveClass(/statement-80mm/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".topbar")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.goto(`/sales/${saleId}/print`);
  await expect(page.locator("article.cash-memo")).toBeVisible();
  await expect(page.locator("article.cash-memo")).toContainText("MEMO-");
  if (testInfo.project.name === "chrome-desktop") {
    try {
      await updateReceiptSize("80mm");
      await page.reload();
      await expect(page.locator("article.cash-memo")).toHaveClass(/receipt-80mm/);
      await updateReceiptSize("58mm");
      await page.reload();
      await expect(page.locator("article.cash-memo")).toHaveClass(/receipt-58mm/);
      await page.emulateMedia({ media: "print" });
      const pdf = await page.pdf({ format: "A4", printBackground: true });
      expect(pdf.byteLength).toBeGreaterThan(1_000);
      await expect(page.locator(".sidebar")).toBeHidden();
      await expect(page.locator(".topbar")).toBeHidden();
    } finally {
      await updateReceiptSize("a4");
    }
  }

  const actionableNetworkErrors = networkErrors.filter(
    (message) => !message.includes("net::ERR_ABORTED"),
  );
  expect(actionableNetworkErrors, actionableNetworkErrors.join("\n")).toEqual([]);
  expect(
    consoleErrors.filter(
      (message) =>
        !message.includes("Download the React DevTools") &&
        !message.startsWith("Failed to load resource: the server responded with a status of 404"),
    ),
    consoleErrors.join("\n"),
  ).toEqual([]);
});
