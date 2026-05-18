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
      KPR_PRIVATE_KEY: '0x0000000000000000000000000000000000000000000000000000000000000001',
      BASE_RPC_URL: 'https://mainnet.base.org',
      BASE_SOLANA_BRIDGE_ADDRESS: '0x3eff766c76a1be2ce1acf2b69c78bcae257d5188',
      VAULT_ADDRESS: '0x0000000000000000000000000000000000000001',
      ORACLE_ADDRESS: '0x0000000000000000000000000000000000000002',
      CCA_STRATEGY_ADDRESS: '0x0000000000000000000000000000000000000003',
      VRF_HUB_ADDRESS: '0x0000000000000000000000000000000000000004',
    },
  },
});
