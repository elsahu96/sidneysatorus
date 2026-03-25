/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4567,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8080",
        changeOrigin: true,
        rewrite: (reqPath) => reqPath.replace(/^\/api/, ""),
      },
      "/ws": {
        target: process.env.VITE_WS_URL || "ws://localhost:8080",
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ws/, "/ws"),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
}));
