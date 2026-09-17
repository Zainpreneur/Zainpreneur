import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Cross-origin isolation is required for the SQLite OPFS SAH-pool VFS
// (SharedArrayBuffer-based worker synchronization). Production hosting must
// send the same two headers for the OPFS backend; otherwise the engine falls
// back to in-memory + journaled persistence.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5900,
    headers: isolationHeaders,
  },
  preview: {
    port: 5900,
    headers: isolationHeaders,
  },
  worker: {
    format: 'es',
  },
})
