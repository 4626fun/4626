import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
  },
})
