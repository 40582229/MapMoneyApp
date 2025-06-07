/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['.loca.lt'] // This matches subdomains like xyz.ngrok-free.app

  },
});
