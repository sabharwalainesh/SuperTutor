import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverPort = process.env.PORT ?? process.env.API_PORT ?? '8787';
const target = `http://127.0.0.1:${serverPort}`;

export default defineConfig({
  root: __dirname,
  // Absolute base: the app is served from the root of one origin.
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin in development too, so the session cookie behaves exactly as in production.
    proxy: { '/api': { target, changeOrigin: false }, '/mcp': { target, changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Monaco is large; split it out so the workspace shell is not held up by the editor.
    rollupOptions: { output: { manualChunks: { monaco: ['monaco-editor'] } } },
    chunkSizeWarningLimit: 4_000,
  },
});
