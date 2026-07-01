import { describe, expect, it } from 'vitest'

import type { ArenaConfig } from './arenaConfig.js'
import { isAssetAllowlisted, validateArenaPair } from './arenaPairPolicy.js'

function mockConfig(overrides: Partial<ArenaConfig> = {}): ArenaConfig {
  return {
    enabled: true,
    tradingEnabled: true,
    creationEnabled: true,
    dryRun: true,
    agentId: null,
    agentWalletAddress: null,
    hlApiWalletAddress: null,
    hlAgentPrivateKey: null,
    hlMasterAddressOverride: null,
    hlSubaccountAddress: null,
    commandTimeoutMs: 60_000,
    maxUsdcDeposit: 50_000,
    maxTradeSizeUsd: 100_000,
    allowedRoomIds: ['1659'],
    dgclawDir: '/tmp',
    dgclawBin: './dgclaw.sh',
    acpBin: 'acp',
    nodeRunnerBin: 'npx',
    hip3PrefixRequired: true,
    assetAllowlist: null,
    ...overrides,
  }
}

describe('validateArenaPair', () => {
  it('accepts crypto perp symbols without prefix', () => {
    const result = validateArenaPair('btc', mockConfig())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalizedPair).toBe('BTC')
      expect(result.market).toBe('crypto')
    }
  })

  it('accepts HIP-3 symbols with xyz prefix', () => {
    const result = validateArenaPair('xyz:gold', mockConfig())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.normalizedPair).toBe('xyz:GOLD')
      expect(result.market).toBe('hip3')
    }
  })

  it('rejects non-xyz colon pairs', () => {
    const result = validateArenaPair('abc:GOLD', mockConfig())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('hip3_prefix_required')
    }
  })

  it('enforces allowlist when configured', () => {
    const result = validateArenaPair(
      'xyz:GOLD',
      mockConfig({ assetAllowlist: new Set(['BTC']) }),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('asset_not_allowlisted')
    }
  })
})

describe('isAssetAllowlisted', () => {
  it('allows all coins when allowlist is unset', () => {
    expect(isAssetAllowlisted('BTC', null)).toBe(true)
    expect(isAssetAllowlisted('HYPE', undefined)).toBe(true)
  })

  it('allows only listed coins', () => {
    const allowlist = new Set(['HYPE'])
    expect(isAssetAllowlisted('HYPE', allowlist)).toBe(true)
    expect(isAssetAllowlisted('hype', allowlist)).toBe(true)
    expect(isAssetAllowlisted('BTC', allowlist)).toBe(false)
  })
})
