import { expect, test } from "@playwright/test";
import { mockLearning } from "./mock-learning";

test("profile correction stays in the main panel and preserves the draft on failure", async ({
  page,
}) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({
      json: {
        id: "student",
        nickname: "小芽",
        email: "student@example.com",
        avatar: "",
      },
    }),
  );
  const state = {
    id: "session",
    purpose: "onboarding",
    completed: true,
    question: null,
    messages: [],
    memory: "喜欢先看例子",
    memoryVersion: 1,
    messageSequence: 0,
    revision: 0,
    status: "idle",
    leaseUntil: "",
  };
  await page.route("**/api/learning/model", (r) =>
    r.fulfill({ json: { id: "test", available: true } }),
  );
  let failClaim: () => void = () => {};
  const claim = new Promise<void>((resolve) => {
    failClaim = resolve;
  });
  await mockLearning(
    page,
    () => state,
    async (action) => {
      if (action.action === "end_correction") {
        return { state: { ...state, correctionEnded: true, revision: 1 } };
      }
      await claim;
      throw new Error("暂时无法修改，请重试");
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "自由探索" }).click();
  await page.getByRole("button", { name: "用户菜单" }).click();
  await page.getByRole("button", { name: "学习档案", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const dialog = page.getByRole("region", { name: "学习档案" });
  await dialog
    .getByRole("textbox", { name: "修改或忘记" })
    .fill("我想先自己试试");
  await dialog.getByRole("button", { name: "提交修改" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status", { name: "正在思考" })).toContainText(
    "思考中",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "探索即将开放" })).toHaveCount(
    0,
  );
  failClaim();
  await expect(page.getByRole("alert")).toContainText("暂时无法修改");
  await expect(
    page.getByRole("banner").getByRole("button", { name: "停止对话" }),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("button", { name: "返回档案" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "停止对话" }).click();
  await expect(dialog.getByRole("textbox", { name: "修改或忘记" })).toBeEmpty();
});
