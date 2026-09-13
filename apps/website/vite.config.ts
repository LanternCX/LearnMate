import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/zhiya/" : "/",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4174,
    strictPort: true,
  },
}));
