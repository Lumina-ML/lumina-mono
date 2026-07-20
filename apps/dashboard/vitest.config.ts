import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@lumina/ui/style.css", replacement: resolve(__dirname, "../../packages/lumina-ui/src/theme/theme.css") },
      { find: "@lumina/ui", replacement: resolve(__dirname, "../../packages/lumina-ui/src/index.ts") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  test: {
    environment: "happy-dom",
    globals: true,
  },
});
