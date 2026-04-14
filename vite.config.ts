import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Allow triple-slash reference to vitest globals (test, expect, describe, vi)
/// <reference types="vitest" />

export default defineConfig(({ mode }) => {
  // BACKEND_URL lets anyone on the LAN run just the frontend and proxy API
  // calls to a shared backend on another machine. Default: local backend.
  //
  // Example: another dev on the network adds to their .env.local:
  //   BACKEND_URL=http://10.3.13.126:8000
  // (no VITE_ prefix — this is server-side proxy config, not exposed to the bundle)
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/api': path.resolve(__dirname, './src/api'),
        '@/core': path.resolve(__dirname, './src/core'),
        '@/ui': path.resolve(__dirname, './src/ui'),
        '@/features': path.resolve(__dirname, './src/features'),
        '@/shared': path.resolve(__dirname, './src/shared'),
        '@/store': path.resolve(__dirname, './src/store'),
        '@/assets': path.resolve(__dirname, './src/assets'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-accordion',
              '@radix-ui/react-select',
              '@radix-ui/react-dropdown-menu',
            ],
            'vendor-motion': ['framer-motion'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
      // Source maps expose original TypeScript in browser DevTools.
      // Enable only in development; never ship to production.
      sourcemap: process.env.NODE_ENV !== 'production',
    },
    server: {
      port: 5173,
      strictPort: true,
      // Bind to all interfaces so the dev server is reachable via LAN IP,
      // not just localhost. Required for remote/mobile device testing.
      host: true,
      hmr: {
        // HMR must use the client port (5173) explicitly when accessed via LAN IP,
        // otherwise the browser tries to open a WebSocket to an internal address.
        clientPort: 5173,
        overlay: false,
      },
      proxy: {
        // Forward all /api/* requests from the browser to the Laravel backend.
        // The proxy runs server-side (machine → machine), so the browser always
        // sends requests to the Vite origin regardless of whether it connected via
        // localhost or a LAN IP. This eliminates CORS entirely in development and
        // ensures the correct backend is reached in both scenarios.
        //
        // Override the target by setting BACKEND_URL in .env.local, e.g.:
        //   BACKEND_URL=http://10.3.13.126:8000
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          // Disable SSL verification only when the backend URL is HTTP (local dev).
          // If BACKEND_URL is set to an HTTPS endpoint, SSL verification is enforced.
          secure: backendUrl.startsWith('https://'),
          // Fail fast if the backend is unresponsive — prevents indefinite hangs
          // when php artisan serve is slow or not yet running. Without these,
          // a single stuck request blocks the browser connection indefinitely,
          // triggering useAuthInit's 20-second retry cascade.
          timeout: 10000,
          proxyTimeout: 10000,
        },
      },
    },
    // ─── Vitest ──────────────────────────────────────────────────────────────────
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/__tests__/setup.ts'],
      globals: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'clover'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.test.{ts,tsx}',
          'src/**/*.spec.{ts,tsx}',
          'src/__tests__/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
      },
    },

    optimizeDeps: {
      include: [
        // Core framework
        'react',
        'react-dom',
        'react-router-dom',
        // State management
        '@reduxjs/toolkit',
        'react-redux',
        'redux-persist',
        // Animation
        'framer-motion',
        // i18n — large, frequently cold-start transformed
        'i18next',
        'react-i18next',
        // HTTP client
        'axios',
        // Date utilities — tree-shaken but still slow to transform cold
        'date-fns',
        // Toast notifications
        'sonner',
        // Radix UI primitives used in every authenticated page
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-select',
        '@radix-ui/react-accordion',
        // DOMPurify (used in inbox thread rendering)
        'dompurify',
      ],
    },
  };
});
