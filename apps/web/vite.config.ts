import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, proxy API + auth calls to the Fastify host so the browser stays
// same-origin (cookies "just work", no CORS dance).
const API_TARGET = process.env.API_TARGET ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_TARGET, changeOrigin: true },
      "/auth": { target: API_TARGET, changeOrigin: true },
      "/healthz": { target: API_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
