import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves from /<repo-name>/. GITHUB_REPOSITORY is set automatically in Actions,
  // so forks deploy correctly without edits; local dev and the original repo keep '/feeds/'.
  base: process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` : '/feeds/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
