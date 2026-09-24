import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Chess-game/',
  root: '.',
  publicDir: 'public',
  server: {
    host: true,
    port: 5173,
  },
});
