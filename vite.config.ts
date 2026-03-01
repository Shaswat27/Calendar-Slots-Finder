import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // Setting the root to 'client' means Vite starts its search inside that folder
  root: path.resolve(__dirname, "client"),
  // publicDir is relative to root, so this points to client/public
  publicDir: path.resolve(__dirname,"client/public"),
  resolve: {
    alias: {
      // Use absolute paths for aliases to avoid confusion
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "client/index.html"),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // This is key: ensure Vite knows how to serve the nested index.html
    fs: {
      allow: [".."], 
    },
  },
});