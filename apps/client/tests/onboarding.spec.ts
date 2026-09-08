import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { root } from "../../../scripts/config.mjs";

test("Pi resumes a persisted question across devices and saves memory before completing", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90000);
  const email = `onboarding-${Date.now()}@example.com`;
  const headers = {
    "Content-Type": "application/json",
    "X-Zhiya-Request": "1",
  };
  const started = await context.request.post("/api/auth/register/start", {
    headers,
    data: { email },
  });
  expect(started.ok()).toBeTruthy();
  const { flow } = await started.json();
  const services = parseEnv(
    readFileSync(
      resolve(root, process.env.ZHIYA_SERVICES_ENV ?? "dev-services.env"),
      "utf8",
    ),
  );
  const mailpit =
    "http://" + (process.env.MAILPIT_HTTP_BIND ?? services.MAILPIT_HTTP_BIND);
  let code = "";
  await expect
    .poll(async () => {
      const inbox = await (
        await request.get(mailpit + "/api/v1/messages")
      ).json();
      const message = inbox.messages.find((m: { To: { Address: string }[] }) =>
        m.To.some((t) => t.Address === email),
      );
      if (!message) return false;
      const detail = await (
        await request.get(mailpit + "/api/v1/message/" + message.ID)
      ).json();
      code = detail.Text.match(/验证码：(\d{8})/)?.[1] ?? "";
      return !!code;
    })
    .toBeTruthy();
  const password = "Onboarding-password-123";
  expect(
    (
      await context.request.post("/api/auth/register/complete", {
        headers,
        data: { flow, code, password },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await context.request.post("/api/auth/login", {
        headers,
        data: { email, password },
      })
    ).ok(),
  ).toBeTruthy();
  await context.route("**/api/learning/model", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { id: "gpt-5.6-luna", available: true } });
      return;
    }
    const payload = route.request().postDataJSON().payload;
    const results = payload.messages.filter(
      (m: { role: string }) => m.role === "tool",
    );
    const calls = [
      {
        id: "q-first",
        name: "ask_student",
        arguments: JSON.stringify({
          text: "你以前用过 Scratch 吗？",
          kind: "single",
          options: ["用过", "还没用过"],
        }),
      },
      {
        id: "memory-first",
        name: "update_memory",
        arguments: JSON.stringify({
          content: "学生自述用过 Scratch。",
          version: 0,
        }),
      },
      { id: "complete-first", name: "complete_onboarding", arguments: "{}" },
    ];
    const call = calls[results.length];
    const delta = call
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.arguments },
            },
          ],
        }
      : { role: "assistant", content: "我们开始慢慢探索吧。" };
    const chunk = {
      id: "mock-completion",
      object: "chat.completion.chunk",
      created: 1,
      model: "gpt-5.6-luna",
      choices: [{ index: 0, delta, finish_reason: null }],
    };
    const end = {
      ...chunk,
      choices: [
        { index: 0, delta: {}, finish_reason: call ? "tool_calls" : "stop" },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    };
    await route.fulfill({
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "你以前用过 Scratch 吗？" }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.setViewportSize({ width: 390, height: 844 });
  await other.goto("/");
  await expect(
    other.getByRole("heading", { name: "你以前用过 Scratch 吗？" }),
  ).toBeVisible();
  expect(
    await other.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await other.screenshot({
    path: "test-results/onboarding-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.screenshot({
    path: "test-results/onboarding-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await other.reload();
  await expect(
    other.getByRole("heading", { name: "你以前用过 Scratch 吗？" }),
  ).toBeVisible();
  await other.getByRole("radio", { name: "用过", exact: true }).check();
  await other.getByRole("button", { name: "提交回答", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "学习者，欢迎回来。" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    other.getByRole("heading", { name: "学习者，欢迎回来。" }),
  ).toBeVisible();
  await other
    .getByRole("button", { name: "知芽记得的我", exact: true })
    .click();
  await expect(
    other.getByText("学生自述用过 Scratch。", { exact: true }),
  ).toBeVisible();
  const saved = await (await context.request.get("/api/learning")).json();
  expect(
    saved.messages.filter(
      (m: { role: string; toolCallId: string }) =>
        m.role === "toolResult" && m.toolCallId === "q-first",
    ),
  ).toHaveLength(1);
  await other.close();
});

test("a student answers one concrete question and sees the overview when the agent finishes", async ({
  page,
}) => {
  let completed = false;
  const state = () => ({
    id: "00000000-0000-4000-8000-000000000001",
    purpose: "onboarding",
    messages: [],
    completed,
    memory: "喜欢先看一个例子，再自己试试。",
    memoryVersion: 1,
    revision: completed ? 1 : 0,
    status: completed ? "idle" : "waiting",
    leaseUntil: "2099-01-01T00:00:00Z",
    question: completed
      ? null
      : {
          id: "question-1",
          text: "学一个新东西时，你想先试哪一种？",
          kind: "single",
          options: ["看一个例子", "自己试一试"],
        },
  });
  await page.route("**/api/me", (route) =>
    route.fulfill({
      json: {
        id: "student",
        nickname: "小芽",
        email: "student@example.com",
        avatar: "",
      },
    }),
  );
  await page.route("**/api/learning", (route) =>
    route.fulfill({ json: state() }),
  );
  await page.route("**/api/learning/model", (route) =>
    route.fulfill({ json: { id: "test", available: false } }),
  );
  await page.route("**/api/learning/sync", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ json: state() });
  });
  await page.route("**/api/learning/action", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.action).toBe("answer");
    expect(body.answer.selected).toEqual(["看一个例子"]);
    completed = true;
    await route.fulfill({ json: state() });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "学一个新东西时，你想先试哪一种？" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "提交回答", exact: true }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "看一个例子" }).check();
  await page.getByRole("button", { name: "提交回答", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "小芽，欢迎回来。" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "知芽记得的我", exact: true }).click();
  await expect(
    page.getByText("喜欢先看一个例子，再自己试试。", { exact: true }),
  ).toBeVisible();
});
