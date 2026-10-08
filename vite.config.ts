import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev-only proxies so the browser never deals with CORS while developing:
//   /api/monitoring/* -> monitoring API (Render)   e.g. /api/monitoring/app/live
//   /api/n8n/*        -> n8n webhooks              e.g. /api/n8n/get-my-tickets
// In production these are replaced by the real origins via VITE_* variables.
//
// BASE_PATH: "/" locally; "/customer-portal/" when built for GitHub Pages (set by the workflow).
export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api/monitoring": {
        target: "https://monitoring.solvivaenergy.com",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/monitoring/, ""),
      },
      "/api/n8n": {
        target: "https://solviva.app.n8n.cloud",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/n8n/, "/webhook"),
      },
    },
  },
});
