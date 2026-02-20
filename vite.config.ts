import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VehicleTrackPlugin',
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // Все зависимости платформы — внешние
      external: ['albatros/enums', 'albatros'],
      output: {
        exports: 'named',
      },
    },
    sourcemap: true,
    minify: false,
  },
});
