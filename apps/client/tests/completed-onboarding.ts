import type { Page } from "@playwright/test";
import { mockLearning } from "./mock-learning";

// Account tests start after onboarding; its completion is tested separately.
export async function completedOnboarding(page: Page) {
  const state = {
    id: "completed-session",
    purpose: "onboarding",
    messages: [],
    completed: true,
    memory: "",
    memoryVersion: 0,
    messageSequence: 0,
    revision: 0,
    status: "idle",
    leaseUntil: "",
    question: null,
  };
  await mockLearning(page.context(), () => state);
  await page
    .context()
    .route("**/api/learning/model", (route) =>
      route.fulfill({ json: { available: false } }),
    );
}
