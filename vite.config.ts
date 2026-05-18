import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ui/',
  plugins: [react(), tailwindcss()],
  root: 'ui',
  build: {
    emptyOutDir: true,
    outDir: '../app/ui',
  },
});
