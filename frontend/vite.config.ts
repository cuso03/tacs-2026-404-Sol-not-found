import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // mapea a 0.0.0.0 para que Docker exponga el puerto
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // Ayuda a que el hot-reload funcione bien en volúmenes de Windows a Docker
    },
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
})
