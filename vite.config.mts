import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hasHttps = Boolean(env.LOCAL_HTTPS_CERT || env.LOCAL_HTTPS_KEY);
  if (hasHttps && (!env.LOCAL_HTTPS_CERT || !env.LOCAL_HTTPS_KEY || !env.APP_ORIGIN?.startsWith('https://'))) {
    throw new Error('Локальный HTTPS требует сертификат, ключ и APP_ORIGIN с https.');
  }
  return {
    root: 'apps/web',
    plugins: [react(), tailwindcss()],
    server: {
      host: hasHttps ? env.LOCAL_HTTPS_HOST || '127.0.0.1' : '127.0.0.1',
      https: hasHttps ? { cert: readFileSync(env.LOCAL_HTTPS_CERT), key: readFileSync(env.LOCAL_HTTPS_KEY) } : undefined,
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
