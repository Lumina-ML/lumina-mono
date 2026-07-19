import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // 数组形式:先匹配更具体的别名,避免 `@lumina/ui` 把
    // `@lumina/ui/style.css` 吃掉、错误拼成 `${index.ts}/style.css`。
    alias: [
      { find: "@lumina/ui/style.css", replacement: resolve(__dirname, "../../packages/lumina-ui/src/theme/theme.css") },
      // 让 dashboard dev/build 直接消费 @lumina/ui 的源码,
      // 避免之前「dist 跟源码脱节 / vite 缓存陈旧产物」的问题。
      // 同时 Docker 构建不再依赖先 pnpm --filter @lumina/ui build 这一步。
      { find: "@lumina/ui", replacement: resolve(__dirname, "../../packages/lumina-ui/src/index.ts") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
