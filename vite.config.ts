import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': JSON.stringify({}),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5004,
    cors: true,
    proxy: {
      '/api': {
        target: 'https://nkz.robotika.cloud',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/moduleEntry.ts'),
      name: 'NkzModuleRobotics',
      formats: ['iife'],
      fileName: () => 'nekazari-module.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react-router-dom', '@nekazari/sdk', '@nekazari/ui-kit', '@nekazari/design-tokens', '@nekazari/viewer-kit'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
          '@nekazari/sdk': '__NKZ_SDK__',
          '@nekazari/ui-kit': '__NKZ_UI__',
          '@nekazari/design-tokens': '__NKZ_DESIGN_TOKENS__',
          '@nekazari/viewer-kit': '__NKZ_VIEWER_KIT__',
        },
        intro: 'var process = { env: {} };',
      },
    },
  },
});
