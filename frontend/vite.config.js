import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Dev requests to /api are forwarded to the Django server.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Uploaded question images (graphs, charts) are served by Django.
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
