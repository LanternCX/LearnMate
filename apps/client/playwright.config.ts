import { defineConfig } from "@playwright/test";
import { loadClientConfig } from "../../scripts/config.mjs";

const { config } = loadClientConfig();

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  use: {
    baseURL: config.dev_origin,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: [
    {
      command: "npm run dev",
      url: config.dev_origin,
      reuseExistingServer: false,
    },
    {
      command: "node ../../scripts/run.mjs server",
      url: config.api_origin + "/health",
      reuseExistingServer: false,
    },
  ],
});
