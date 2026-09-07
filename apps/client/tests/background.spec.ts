import { expect, test } from "@playwright/test";

test("the background responds to the pointer and respects reduced motion", async ({ page }) => {
  await page.goto("/");
  const background = page.locator(".ambient-background");
  await expect(background).toBeVisible();
  await expect(page.locator("header button")).toHaveCount(1);
  await page.mouse.move(100, 100);
  await expect(background).toHaveAttribute("style", /--drift-x:/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".ambient-light")).toHaveCSS("animation-name", "none");
  for (const patch of await page.locator(".ambient-patch").all()) {
    await expect(patch).toHaveCSS("animation-name", "none");
  }
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await expect(page.getByRole("heading", { name: "注册账号" })).toBeVisible();
  await expect(background).toBeVisible();
});
