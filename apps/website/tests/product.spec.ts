import { expect, test } from "@playwright/test";

test("content and footer share one uninterrupted green gradient", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("body")).toHaveCSS("background-image", /linear-gradient/);
  await expect(page.locator("body")).toHaveCSS("background-attachment", "scroll");
  for (const selector of [".site-content", ".site-footer"]) {
    await expect(page.locator(selector)).toHaveCSS("background-image", "none");
    await expect(page.locator(selector)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
});

test("product entry is reserved and grade selection shows one unframed explanation", async ({ page }) => {
  await page.goto("./");
  const address = page.url();
  for (const entry of await page.getByRole("button", { name: "进入知芽", exact: true }).all()) {
    await expect(entry).toBeDisabled();
  }
  await expect(page.getByRole("button", { name: "进入知芽", exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "小学低年级", exact: true }).click();
  await expect(page.getByRole("heading", { name: "故事与观察", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "小学低年级", exact: true }).press("End");
  await expect(page.getByRole("tab", { name: "高中", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "模型与项目", exact: true })).toBeVisible();
  await expect(page).toHaveURL(address);

  await expect(page.locator("#lesson .teaching-media")).toBeVisible();
  await expect(page.locator(".teaching-media img")).toHaveCount(0);
  await expect(page.locator(".lesson-ring, .lesson-dot")).toHaveCount(0);
  for (const region of await page.locator(".stage-detail, .modality-grid article, .lesson-copy").all()) {
    await expect(region).toHaveCSS("background-image", "none");
    await expect(region).toHaveCSS("box-shadow", "none");
    await expect(region).toHaveCSS("border-top-width", "0px");
  }
});

test("classroom steps work without navigating and the FAQ is removed", async ({ page }) => {
  await page.goto("./");
  const address = page.url();
  await page.getByRole("tab", { name: "反馈", exact: true }).click();
  await expect(page.getByRole("heading", { name: "下一步学习什么？", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "反馈", exact: true }).press("Home");
  await expect(page.getByRole("tab", { name: "提问", exact: true })).toBeFocused();
  await expect(page.getByRole("heading", { name: "AI 为什么会认错？", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "你可能想了解" })).toHaveCount(0);
  await expect(page.locator('a[href="#questions"]')).toHaveCount(0);
  await expect(page).toHaveURL(address);
});

test("grade and modality sections reserve blank real-image areas with black light-theme text", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("./");
  for (const name of ["小学低年级", "小学高年级", "初中", "高中"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    const media = page.locator("#stages .teaching-media");
    await expect(media).toBeVisible();
    await expect(media).toHaveAttribute("aria-label", `知芽 ${name}教学实景`);
    await expect(media.locator("img")).toHaveCount(0);
  }
  await expect(page.locator("#multimodal .teaching-media")).toHaveCount(3);
  for (const media of await page.locator("#multimodal .teaching-media").all()) {
    await expect(media).toBeVisible();
    await expect(media.locator("img")).toHaveCount(0);
    await expect(media).toHaveCSS("box-shadow", "none");
    await expect(media).toHaveCSS("border-top-width", "0px");
  }
  for (const text of await page.locator("#stages h3, #stages p, #multimodal h3, #multimodal p").all()) {
    await expect(text).toHaveCSS("color", "rgb(0, 0, 0)");
  }
});
