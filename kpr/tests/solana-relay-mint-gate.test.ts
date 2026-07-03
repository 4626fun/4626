import { describe, expect, it } from 'vitest'

import { isMintRelayEnabled } from '../utils/solanaRelayMintGate.js'

describe('solanaRelayMintGate', () => {
  function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
    const previous: Record<string, string | undefined> = {}
    for (const key of Object.keys(values)) {
      previous[key] = process.env[key]
      const next = values[key]
      if (next === undefined) delete process.env[key]
      else process.env[key] = next
    }
    try {
      return fn()
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  }

  it('allows all mints when per-mint gating is off', () => {
    withEnv({ SOLANA_RELAY_PER_MINT_GATING: undefined, SOLANA_RELAY_ENABLED_MINTS: '' }, () => {
      expect(isMintRelayEnabled('Mint1111111111111111111111111111111111111')).toBe(true)
    })
  })

  it('allows only listed mints when per-mint gating is on', () => {
    const mint = 'Mint1111111111111111111111111111111111111'
    withEnv(
      {
        SOLANA_RELAY_PER_MINT_GATING: '1',
        SOLANA_RELAY_ENABLED_MINTS: mint,
      },
      () => {
        expect(isMintRelayEnabled(mint)).toBe(true)
        expect(isMintRelayEnabled('Other111111111111111111111111111111111111')).toBe(false)
      },
    )
  })
})
