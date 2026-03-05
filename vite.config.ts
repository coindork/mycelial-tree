import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/mycelial-tree/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
})
