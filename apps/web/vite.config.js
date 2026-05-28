import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const devPort = Number(process.env.WEB_DEV_PORT ?? "5173");
const apiTarget = process.env.WEB_API_TARGET ?? "http://127.0.0.1:8080";
const proxyPrefixes = ["/health", "/live", "/map", "/ops", "/registry", "/charts/overview"];
const proxy = Object.fromEntries(
  proxyPrefixes.map((prefix) => [
    prefix,
    {
      target: apiTarget,
      changeOrigin: true
    }
  ])
);

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: devPort,
    proxy
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true
  }
});
