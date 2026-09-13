import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  use: { ...config.use, baseURL: "http://127.0.0.1:4175/zhiya/" },
  webServer: {
    command: "npm run preview:pages",
    url: "http://127.0.0.1:4175/zhiya/",
    reuseExistingServer: false,
  },
});
