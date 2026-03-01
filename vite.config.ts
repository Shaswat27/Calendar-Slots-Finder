// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect Vercel environment
const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "client"),
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
  server: {
    // port: 3000,
    // Only use the proxy if we ARE NOT on Vercel.
    // On Vercel, the Vercel Router handles /api automatically.
    host: '127.0.0.1',
    strictPort: true,
    proxy: !isVercel ? {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    } : undefined,
  },
});