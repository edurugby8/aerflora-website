import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Published on GitHub Pages as https://<user>.github.io/aerflora-website/
export default defineConfig({
  base: '/aerflora-website/',
  plugins: [react()],
});
