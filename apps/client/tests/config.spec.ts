import { test, expect } from "@playwright/test";
import { root } from "../../../scripts/config.mjs";

test("account forms use the server's current public rules", async ({ page }) => {
  await page.route("**/api/account-rules", async route => {
    const response = await route.fetch();
    const policy = await response.json();
    policy.password_min_characters = 16;
    policy.password_max_bytes = 128;
    policy.verification_code_digits = 6;
    await route.fulfill({ response, json: policy });
  });
  await page.route("**/api/auth/register/start", route =>
    route.fulfill({ json: { flow: "test-flow" } }),
  );
  await page.goto("/");
  await expect(page.getByLabel("密码", { exact: true })).toHaveAttribute("maxlength", "128");
  await page.getByRole("button", { name: "注册账号", exact: true }).click();
  await page.getByLabel("邮箱", { exact: true }).fill("policy@example.com");
  await page.getByRole("button", { name: "发送验证码", exact: true }).click();
  await expect(page.getByText("密码至少 16 个字符。", { exact: true })).toBeVisible();
  await expect(page.getByLabel("验证码", { exact: true })).toHaveAttribute("maxlength", "6");
});

test("development server does not serve the private configuration file", async ({ request }) => {
  const response = await request.get("/@fs/" + root + "apps/server/config.yaml");
  expect(response.status()).toBe(403);
});

test("failure to load rules offers retry instead of rendering forms without rules", async ({ page }) => {
  await page.route("**/api/account-rules", route =>
    route.fulfill({ status: 401, json: { error: "Rules unavailable" } }),
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: "重试", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录知芽" })).not.toBeVisible();
});
