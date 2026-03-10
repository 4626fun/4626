import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['api/__tests__/**/*.test.ts', 'src/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    // The suite mixes native-image tests and route-heavy module loading; keeping
    // fork concurrency low avoids cross-file timeout flakiness under full runs.
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 2,
      },
    },
  },
})
