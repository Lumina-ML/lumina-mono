import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LuminaUI',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', 'vue-router', 'echarts', 'vue-echarts'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          echarts: 'echarts',
          'vue-echarts': 'VueECharts',
        },
      },
    },
  },
});
