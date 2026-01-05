import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path set to './' for maximum compatibility (works on subpaths, IPFS, local file system)
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})
