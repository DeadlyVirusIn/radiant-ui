import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        ws: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Performance optimizations
    rollupOptions: {
      output: {
        // Manual chunks for better caching
        // Note: MUI and Emotion must be in the same chunk due to internal dependencies
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // recharts removed from manualChunks — now lazy-loaded only on pages that use charts
          // (HuntMonitor, GodPackGallery). Saves ~421KB from initial load for all other pages.
          'vendor-motion': ['framer-motion'],
          'vendor-socket': ['socket.io-client'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 800,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material',
      '@mui/icons-material',
      '@emotion/react',
      '@emotion/styled',
      'framer-motion',
      'socket.io-client',
    ],
  },
})
