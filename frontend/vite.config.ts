import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'), // Maps @ to the src directory
      },
    },
  // Dev and preview both forward API calls to the backend, so the app always
  // talks to "/api" same-origin (matching the production single-server setup).
  server: {
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
})
