import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VehicleTrackPlugin',
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['vue', '@topomatic/albatros'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
});
