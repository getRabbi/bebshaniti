import { expect, test } from "@playwright/test";

const landingUrl = process.env.PUBLIC_LANDING_URL ?? "http://127.0.0.1:3001";
const merchantUrl = process.env.MERCHANT_APP_URL ?? "http://127.0.0.1:3000";
const platformUrl = process.env.PLATFORM_CONSOLE_URL ?? "http://127.0.0.1:3002";

test("Bangla-first landing links to merchant registration", async ({ page }) => {
  await page.goto(landingUrl);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn-BD");
  await expect(page.getByRole("heading", { name: "ব্যবসার প্রতিটি হিসাব থাকুক আপনার নিয়ন্ত্রণে।", exact: true })).toBeVisible();
  const language = page.locator("header .site-language select");
  await expect(language).toHaveCount(1);
  await expect(language).toHaveValue("bn");
  await expect(page.getByRole("link", { name: "অ্যাকাউন্ট খুলুন", exact: true })).toHaveAttribute("href", `${merchantUrl}/register`);
  await language.selectOption("en");
  await expect(page.getByRole("heading", { name: "Keep every part of your business under control.", exact: true })).toBeVisible();
  await page.reload();
  await expect(language).toHaveValue("en");
});

test("merchant auth stays Bangla-first without an auth-form language switch", async ({ page }) => {
  await page.goto(`${merchantUrl}/login`);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn-BD");
  await expect(page.locator(".auth-language")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "লগইন", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "অ্যাকাউন্ট তৈরি করুন", exact: true })).toHaveAttribute("href", "/register");
});

test("platform console exposes login only and no public registration", async ({ page }) => {
  await page.goto(`${platformUrl}/login`);
  await expect(page.getByRole("heading", { name: "প্ল্যাটফর্ম কন্ট্রোল", exact: true })).toBeVisible();
  await expect(page.getByText("শুধু অনুমোদিত platform operator এই console ব্যবহার করতে পারবেন।", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /অ্যাকাউন্ট|register|sign up/i })).toHaveCount(0);
  await expect(page.locator('input[name="email"]')).toHaveCount(1);
  await expect(page.locator('input[name="password"]')).toHaveCount(1);
});
