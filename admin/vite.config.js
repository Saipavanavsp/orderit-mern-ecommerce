// OrderIt - (c) 2026 Sai Pavan (https://github.com/Saipavanavsp). All rights reserved.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = Number(env.ADMIN_PORT || 5174);
  return {
    plugins: [react()],
    server: { port, strictPort: true, host: 'localhost' },
    preview: { port, strictPort: true },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
  };
});
