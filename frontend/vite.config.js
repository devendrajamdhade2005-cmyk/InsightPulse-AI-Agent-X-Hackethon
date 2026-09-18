import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Local dev proxies the API to the FastAPI backend so the React app runs on the
 * same origin as the API and needs no CORS handling and no env var.
 *
 * In production (Vercel) the app talks to the deployed backend directly via
 * VITE_API_BASE — see src/lib/config.js.
 *
 * The SSE endpoints stream, so proxy buffering must stay off. Vite's proxy is
 * built on http-proxy and streams by default; `selfHandleResponse: false` keeps
 * it that way.
 */
const BACKEND = process.env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
      "/docs": { target: BACKEND, changeOrigin: true },
      "/openapi.json": { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
