import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // '@/...' resolves to 'src/...' — mirrors tsconfig paths
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    proxy: {
      // APM service routes (must be before the general /api catch-all)
      '/api/v1/services': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/metrics': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/logs': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/traces': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/apm': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/sla-rules': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/alerts': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/alert-channels': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/dependencies': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/workflows': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/dashboards': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      '/api/v1/web-vitals': {
        target: 'http://localhost:8082',
        changeOrigin: true,
      },
      // Billing service routes → apm-billing-service (US-BILL-001)
      '/api/v1/billing': {
        target: 'http://localhost:8086',
        changeOrigin: true,
      },
      // AI service routes → apm-ai-service (Sprint 15)
      '/api/v1/ai': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      // Report service routes → apm-report-service (Sprint 14)
      '/api/v1/reports': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/report-schedules': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      '/api/v1/synthetic-checks': {
        target: 'http://localhost:8084',
        changeOrigin: true,
      },
      // All other /api calls → user-management-service
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split vendor bundles for better cache utilisation
        manualChunks: {
          react:    ['react', 'react-dom'],
          mui:      ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          router:   ['react-router-dom'],
          zustand:  ['zustand'],
          otel:     ['@opentelemetry/api', '@opentelemetry/sdk-trace-web', '@opentelemetry/sdk-trace-base',
                     '@opentelemetry/exporter-trace-otlp-http', '@opentelemetry/resources',
                     '@opentelemetry/instrumentation'],
        },
      },
    },
  },
})
