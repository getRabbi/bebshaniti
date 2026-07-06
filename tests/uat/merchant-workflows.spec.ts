import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function apiEnvironment() {
  const content = readFileSync(
    path.join(process.cwd(), "apps/api/.env"),
    "utf8",
  );
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [
          line.slice(0, index),
          line.slice(index + 1).replace(/^"|"$/g, ""),
        ];
      }),
  );
}

const tag = required("UAT_TAG");
const organizationId = required("UAT_ORGANIZATION_ID");
const email = `uat-${tag}-owner@bebshaniti.test`;
const secrets = apiEnvironment();
const supabaseUrl = secrets.SUPABASE_URL;
const serviceRole = secrets.SUPABASE_SERVICE_ROLE_KEY;
let password = "";

test.beforeAll(async () => {
  expect(process.env.UAT_ALLOW_PRODUCTION_MUTATIONS).toBe("I_UNDERSTAND");
  const headers = {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
  };
  const listing = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
    { headers },
  );
  expect(listing.ok).toBeTruthy();
  const payload = (await listing.json()) as {
    users: Array<{ id: string; email?: string }>;
  };
  const user = payload.users.find((candidate) => candidate.email === email);
  expect(user, `UAT owner ${email} must exist`).toBeTruthy();
  password = `Uat-${randomBytes(18).toString("base64url")}!9a`;
  const update = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user!.id}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  expect(update.ok).toBeTruthy();
});

test("merchant can enter localized product data and complete core workflows", async ({
  page,
}) => {
  const runId = `${tag}-${randomBytes(4).toString("hex")}`;
  const productName = `UAT UI পণ্য ${runId}`;
  const categoryName = `UAT বিভাগ ${runId}`;
  const unitName = `box-${runId.slice(-8)}`;
  const customerName = `UAT UI কাস্টমার ${runId}`;
  const importedProductName = `UAT CSV পণ্য ${runId}`;
  const runtimeFailures: string[] = [];
  page.on("pageerror", (error) => runtimeFailures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500)
      runtimeFailures.push(`${response.status()} ${response.url()}`);
  });

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "লগইন", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect
    .poll(
      async () =>
        (await page.context().cookies()).find(
          (cookie) => cookie.name === "organization_id",
        )?.value,
    )
    .toBe(organizationId);

  await page.goto("/products?add=1");
  await expect(page.locator("section.premium-form")).toBeVisible();
  await page.locator(".suggestion-field input").fill(productName);
  await page.locator('input[name="categoryName"]').fill(categoryName);
  await page.locator('input[name="unitName"]').fill(unitName);
  await page.getByLabel("ক্রয় মূল্য", { exact: true }).fill("১০০.৫০");
  await page.getByLabel("বিক্রয় মূল্য", { exact: true }).fill("১২৫.৭৫");
  await expect(page.getByLabel("ক্রয় মূল্য", { exact: true })).toHaveValue(
    "100.50",
  );
  await expect(page.getByLabel("বিক্রয় মূল্য", { exact: true })).toHaveValue(
    "125.75",
  );
  await page.locator(".advanced-toggle").click();
  await page.locator('input[name="openingStock"]').fill("৫");
  await page.getByRole("button", { name: "সেভ", exact: true }).click();
  await expect(page.locator("section.premium-form")).toHaveCount(0);
  await expect(page.getByText(productName, { exact: true })).toBeVisible();

  const dbHeaders = {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
  };
  const unitCheck = await fetch(
    `${supabaseUrl}/rest/v1/units?organization_id=eq.${organizationId}&symbol=eq.${encodeURIComponent(unitName)}&select=id`,
    { headers: dbHeaders },
  );
  expect(unitCheck.ok).toBeTruthy();
  expect((await unitCheck.json()) as unknown[]).toHaveLength(1);

  await page.goto("/inventory");
  await expect(page.getByText(productName, { exact: true })).toBeVisible();
  await expect(page.locator(".module-error")).toHaveCount(0);

  await page.goto("/customers?add=1");
  await page.locator('input[name="name"]').fill(customerName);
  await page.locator('input[name="creditLimit"]').fill("৫০০");
  await page.getByRole("button", { name: "সেভ", exact: true }).click();
  await expect(page.getByText(customerName, { exact: true })).toBeVisible();

  await page.goto("/sales/new");
  const search = page.getByPlaceholder("নাম, SKU বা বারকোড লিখুন", {
    exact: true,
  });
  await search.fill(productName);
  await search.press("Enter");
  await expect(page.locator(".cart-line")).toHaveCount(1);
  await page.getByLabel("পরিমাণ", { exact: true }).fill("২");
  await expect(page.getByLabel("পরিমাণ", { exact: true })).toHaveValue("2");
  await page
    .getByRole("button", { name: "বিক্রয় সম্পন্ন করুন", exact: true })
    .click();
  await page.waitForURL(/\/sales\/[0-9a-f-]+\/memo$/);
  await expect(page.locator("article.cash-memo")).toBeVisible();

  for (const route of ["/due", "/reports", "/settings"]) {
    await page.goto(route);
    await expect(page.locator(".module-error")).toHaveCount(0);
  }

  await page.goto("/products/import");
  await expect(page.locator('input[type="file"]')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: `uat-${runId}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(
      `\ufeffproduct_name,category,unit,buying_price,selling_price,opening_stock\n${importedProductName},UAT CSV বিভাগ,packet,50.25,75.50,3\n`,
      "utf8",
    ),
  });
  await page.getByRole("button", { name: "প্রিভিউ", exact: true }).click();
  await expect(
    page.getByText(importedProductName, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ইমপোর্ট করুন", exact: true }).click();
  await expect(page.locator(".import-result")).toBeVisible();
  await expect(page.locator(".import-result")).toContainText("1");
  expect(runtimeFailures, runtimeFailures.join("\n")).toEqual([]);
});
