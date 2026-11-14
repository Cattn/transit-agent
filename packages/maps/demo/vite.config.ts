import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Run from the repo root: npm run demo:maps   (or: npm run demo -w @transit/maps)
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: { port: 5180 } // apps/web uses 5173
});
