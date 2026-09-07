import { expect, test } from "@playwright/test";

test("theme cycles, persists, and follows the system only in automatic mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "当前为自动主题，切换至浅色主题" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "当前为浅色主题，切换至深色主题" }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "当前为深色主题，切换至自动主题" }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
});
