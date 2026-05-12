import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Split heavy/rarely-changing deps into their own chunks so the initial
    // login bundle stays small and the rest streams in on demand.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-select',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
            'lucide-react',
          ],
          'date-vendor': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
