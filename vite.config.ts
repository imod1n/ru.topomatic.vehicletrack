import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 9091,
    strictPort: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VehicleTrackPlugin',
      fileName: (format) => `index.${format === 'es' ? 'esm' : format}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['albatros/enums', 'albatros'],
      output: {
        exports: 'named',
        entryFileNames: 'index.mjs',
        chunkFileNames: 'chunk.mjs',
      },
    },
    sourcemap: false,
    minify: false,
  },
});
