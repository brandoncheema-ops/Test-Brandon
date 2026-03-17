import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/hire-onboarding/',
  server: {
    port: 3001,
    proxy: {
      '/hire-onboarding/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hire-onboarding/, ''),
      },
    },
  },
});
