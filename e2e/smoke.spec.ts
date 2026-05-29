import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:8081";

test.describe("Knut Counter", () => {
  test("homepage loads and shows dashboard", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("#root > *", { timeout: 15000 });

    // Screenshot
    await page.screenshot({ path: "e2e/screenshots/homepage.png", fullPage: true });

    // Check the app has rendered
    const rootChildren = await page.locator("#root > *").count();
    expect(rootChildren).toBeGreaterThan(0);

    // Look for dashboard title
    const hasTitle = await page.locator("text=Knut Counter").count();
    expect(hasTitle).toBeGreaterThan(0);
  });

  test("no console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("#root > *", { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Filter out non-critical warnings
    const criticalErrors = errors.filter(e => !e.includes("shadow*") && !e.includes("pointerEvents"));
    
    expect(criticalErrors).toHaveLength(0);
  });
});
