import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../server/_lib/db/postgres.js', () => ({
  isDbConfigured: vi.fn(() => false),
  getDb: vi.fn(async () => null),
}))

import { resolveMeteoraAlphaVaultConfig } from '../../server/_lib/onchain/meteoraAlphaVaultConfig.js'

const CREATOR_TOKEN = '0x5b674196812451B7cEC024FE9d22D2c0b172fa75'
const SOL_MINT = 'So11111111111111111111111111111111111111112'
const BASE_CONFIG = {
  meteoraAlphaVault: '11111111111111111111111111111111',
  alphaVaultProgramId: '11111111111111111111111111111111',
  depositAccounts: [{ pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true }],
  quoteMint: SOL_MINT,
}

describe('resolveMeteoraAlphaVaultConfig', () => {
  const originalEnv = process.env.METEORA_CREATOR_ALPHA_VAULT_MAP_JSON

  beforeEach(() => {
    process.env.METEORA_CREATOR_ALPHA_VAULT_MAP_JSON = originalEnv
  })

  it('resolves creator mapping from env with case-insensitive token keys', async () => {
    process.env.METEORA_CREATOR_ALPHA_VAULT_MAP_JSON = JSON.stringify({
      [CREATOR_TOKEN.toUpperCase()]: BASE_CONFIG,
    })

    const resolved = await resolveMeteoraAlphaVaultConfig({ creatorToken: CREATOR_TOKEN })
    expect(resolved).toMatchObject({
      creatorToken: CREATOR_TOKEN.toLowerCase(),
      source: 'env',
      ...BASE_CONFIG,
    })
  })

  it('reads quote mint from metadata.pair_base_mint fallback', async () => {
    process.env.METEORA_CREATOR_ALPHA_VAULT_MAP_JSON = JSON.stringify({
      [CREATOR_TOKEN.toLowerCase()]: {
        meteoraAlphaVault: BASE_CONFIG.meteoraAlphaVault,
        alphaVaultProgramId: BASE_CONFIG.alphaVaultProgramId,
        depositAccounts: BASE_CONFIG.depositAccounts,
        metadata: { pair_base_mint: SOL_MINT },
      },
    })

    const resolved = await resolveMeteoraAlphaVaultConfig({ creatorToken: CREATOR_TOKEN })
    expect(resolved?.quoteMint).toBe(SOL_MINT)
  })
})
