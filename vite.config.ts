import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
  },
  plugins: [
    {
      // Explicitly serve companion/index.html at /companion and /companion/index.html
      // This works regardless of what root even-dev sets for Vite
      name: 'serve-companion',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0];
          if (url === '/companion' || url === '/companion/' || url === '/companion/index.html') {
            const filePath = resolve(__dirname, 'companion/index.html');
            if (existsSync(filePath)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(readFileSync(filePath, 'utf-8'));
            } else {
              next();
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        companion: resolve(__dirname, 'companion/index.html'),
      },
    },
  },
});
