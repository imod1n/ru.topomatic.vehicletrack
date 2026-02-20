import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      // Точка входа плагина
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VehicleTrackPlugin',
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Vue оставляем внешней зависимостью (предоставляется платформой)
      external: ['vue', '@topomatic/albatros'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
    // Генерируем .d.ts через vue-tsc отдельно
    sourcemap: true,
    minify: false, // оставляем читаемый код для отладки
  },
});
