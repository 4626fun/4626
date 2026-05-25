import { describe, expect, it, vi } from 'vitest'

import { applyKnownVaultDefaults } from '../../server/_lib/onchain/vaultStrategyOnchain.js'
import { buildKeeprConfig, normalizeKeeprAddress } from '../../server/_lib/keepr/keeprConfigBuilder.js'

describe('keeprConfigBuilder', () => {
  it('builds config from enriched artifacts', () => {
    const config = buildKeeprConfig({
      vaultAddress: '0x82c06eaae27b1ca31fa29f22341a162a670a4471',
      chainId: 8453,
      creatorAddress: '0x1111111111111111111111111111111111111111',
      strategyVariant: 'default_strategy',
      groupId: 'bootstrap:test',
      artifacts: {
        creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        shareOFT: '0x4df30fffda1d4a81bcf4dc778292be8ff9752a57',
        oracle: '0x8c044aef10d05bcc53912869db89f6e1f37bc6fc',
        ajnaAdapter: '0x2222222222222222222222222222222222222222',
        ajnaInnerVault: '0x3333333333333333333333333333333333333333',
        ajnaAuth: '0x4444444444444444444444444444444444444444',
        ajnaPool: '0x5555555555555555555555555555555555555555',
      },
    })

    expect(config.vault.creatorCoinAddress).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    expect(config.contracts?.oracle).toBe('0x8c044aef10d05bcc53912869db89f6e1f37bc6fc')
    expect(config.contracts?.ajnaAdapter).toBe('0x2222222222222222222222222222222222222222')
  })

  it('normalizes mixed-case addresses', () => {
    expect(normalizeKeeprAddress('0x1111111111111111111111111111111111111111')).toBe(
      '0x1111111111111111111111111111111111111111',
    )
  })
})

describe('vaultStrategyOnchain AKITA defaults', () => {
  it('fills AKITA artifact defaults for the live vault', () => {
    const artifacts = applyKnownVaultDefaults('0x82C06EaAE27B1Ca31fA29F22341A162A670A4471' as const, {})
    expect(artifacts.creatorToken).toBe('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    expect(artifacts.shareOFT).toBe('0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57')
    expect(artifacts.oracle).toBe('0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC')
  })
})

describe('keeperRegistryBootstrap', () => {
  it('returns disabled warning when auto bootstrap flag is off', async () => {
    vi.stubEnv('KEEPER_REGISTRY_AUTO_BOOTSTRAP_ENABLED', '0')
    const { ensureKeeperRegistryForVault } = await import('../../server/_lib/keepr/keeperRegistryBootstrap.js')
    const result = await ensureKeeperRegistryForVault({
      vaultAddress: '0x82c06eaae27b1ca31fa29f22341a162a670a4471',
    })
    expect(result.keeprProvisioned).toBe(false)
    expect(result.warnings).toContain('auto_bootstrap_disabled_by_feature_flag')
    vi.unstubAllEnvs()
  })
})
