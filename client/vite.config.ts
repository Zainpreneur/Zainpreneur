import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API = process.env.ZP_API ?? "http://127.0.0.1:5178";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Fail loudly rather than sliding to 5174, 5175, 5176… A dev server that
    // silently moves port is how three copies of the same app end up running at
    // once and nobody can say which one they are looking at.
    strictPort: true,
    host: "127.0.0.1",
    proxy: {
      // The API is same-origin in development, so the browser sends the same
      // Origin header it always does and the origin check on writes behaves
      // exactly as it will in production behind one hostname.
      "/api": { target: API, changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: true },
});