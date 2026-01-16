import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Importante para Electron - usar rutas relativas
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Asegurar que los assets usen rutas relativas
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // Mantener nombres consistentes para Electron
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true // Usar siempre el mismo puerto para Electron
  }
})
