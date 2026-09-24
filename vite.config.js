import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Chess-game/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'node',
  },
});
