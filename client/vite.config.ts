import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 2567,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
