import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' : GitHub Pages のサブパス配信でも動くよう相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
});
