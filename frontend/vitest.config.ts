import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['api/__tests__/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    testTimeout: 30_000,
    restoreMocks: true,
    clearMocks: true,
    server: {
      deps: {
        inline: [
          /styled-components/,
          /@privy-io\/react-auth/,
          /@privy-io\/js-sdk-core/,
        ],
      },
    },
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
