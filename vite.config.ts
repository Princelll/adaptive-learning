import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  // companion/index.html lives in public/ — Vite serves public/ as-is at URL root,
  // so localhost:5173/companion/index.html works without any special config.
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
