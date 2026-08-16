import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/, so the deploy workflow sets
  // VITE_BASE. Local dev and preview stay at the root.
  base: process.env.VITE_BASE ?? '/',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    // three.js alone is ~550 kB minified; splitting it buys nothing here.
    chunkSizeWarningLimit: 700,
  },
});
