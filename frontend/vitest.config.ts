import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const serverCoreSrc = fileURLToPath(new URL('./packages/server-core/src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@4626\/server-core$/,
        replacement: fileURLToPath(new URL('./test/server-core-vitest.ts', import.meta.url)),
      },
      {
        find: /^@4626\/server-core\/(.+)$/,
        replacement: `${serverCoreSrc}/$1.ts`,
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
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
    // (Vitest 4: poolOptions.forks.{min,max}Forks moved to top-level workers.)
    pool: 'forks',
    minWorkers: 1,
    maxWorkers: 2,
  },
})
