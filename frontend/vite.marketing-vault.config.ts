import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = path.dirname(fileURLToPath(import.meta.url))

/** Standalone marketing hero bundle for public/immersive/vault-hero/ */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(here, './src') }],
    dedupe: ['react', 'react-dom', 'three'],
  },
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: path.resolve(here, 'dist/marketing-vault-hero'),
    lib: {
      entry: path.resolve(here, 'src/marketing/mountVaultHero.tsx'),
      formats: ['es'],
      fileName: 'vault-hero',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2022',
  },
})
