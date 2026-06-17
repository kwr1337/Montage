import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 10240,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://217.114.15.97',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
