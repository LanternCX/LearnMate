import type { Page } from "@playwright/test";

// Account tests start after onboarding; its completion is tested separately.
export async function completedOnboarding(page: Page) {
  const state = {
    id: "completed-session",
    purpose: "onboarding",
    messages: [],
    completed: true,
    memory: "",
    memoryVersion: 0,
    revision: 0,
    status: "idle",
    leaseUntil: "",
    question: null,
  };
  await page
    .context()
    .route("**/api/learning", (route) => route.fulfill({ json: state }));
  await page
    .context()
    .route("**/api/learning/model", (route) =>
      route.fulfill({ json: { available: false } }),
    );
  await page.context().route("**/api/learning/sync", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ json: state });
  });
}
