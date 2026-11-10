import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'apps/web',
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${env.PORT || 3000}` },
    },
    build: {
      outDir: '../../dist/web',
      emptyOutDir: true,
      target: ['safari16.4', 'chrome111'],
    },
  };
});
