import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['actions/**/*.ts', 'utils/**/*.ts'],
      exclude: ['**/*.test.ts', '**/config.ts'],
    },
    // Mock environment variables for tests
    env: {
      KEEPR_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000001',
      BASE_RPC_URL: 'https://mainnet.base.org',
      VAULT_ADDRESS: '0x0000000000000000000000000000000000000001',
      ORACLE_ADDRESS: '0x0000000000000000000000000000000000000002',
      CCA_STRATEGY_ADDRESS: '0x0000000000000000000000000000000000000003',
      VRF_HUB_ADDRESS: '0x0000000000000000000000000000000000000004',
    },
  },
});
