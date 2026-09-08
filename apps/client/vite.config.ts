import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadClientConfig, publicBuildConfig } from "../../scripts/config.mjs";

const { config } = loadClientConfig();
const web = new URL(config.dev_origin);

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  define: { __ZHIYA_CLIENT_CONFIG__: JSON.stringify(publicBuildConfig(config)) },
  envDir: false,
  server: {
    host: web.hostname.replace(/^\[|\]$/g, ""),
    port: Number(web.port || (web.protocol === "https:" ? 443 : 80)),
    strictPort: true,
    proxy: { "/api": config.api_origin },
    fs: { deny: ["**/apps/server/**", "**/*.yaml", "**/*.yml", "**/*.env", ".env", ".env.*", "*.{crt,pem}", "**/.git/**"] },
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
