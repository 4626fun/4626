import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BASE_SOLANA_BRIDGE,
  readBaseSolanaBridgeFromEnv,
  resolveBaseSolanaBridge,
  resolveBaseSolanaBridgeSync,
} from './resolveBaseSolanaBridge.ts'

describe('resolveBaseSolanaBridge', () => {
  it('prefers env override over default', async () => {
    const envBridge = '0x1111111111111111111111111111111111111111'
    const result = await resolveBaseSolanaBridge({
      env: { BASE_SOLANA_BRIDGE: envBridge },
    })
    expect(result).toEqual({ address: envBridge, source: 'env' })
  })

  it('ignores retired adapterAddress lookups and uses default when env unset', async () => {
    const result = await resolveBaseSolanaBridge({
      env: {},
      adapterAddress: '0x3333333333333333333333333333333333333333',
      publicClient: {
        readContract: async () => {
          throw new Error('adapter BRIDGE() must not be called')
        },
      },
    })
    expect(result).toEqual({ address: DEFAULT_BASE_SOLANA_BRIDGE, source: 'default' })
  })

  it('falls back to the Base Solana bridge default constant', async () => {
    const result = await resolveBaseSolanaBridge({ env: {} })
    expect(result).toEqual({ address: DEFAULT_BASE_SOLANA_BRIDGE, source: 'default' })
  })

  it('ignores zero and invalid env values', () => {
    expect(
      readBaseSolanaBridgeFromEnv({
        BASE_SOLANA_BRIDGE: '0x0000000000000000000000000000000000000000',
        SOLANA_BRIDGE_CORE: 'not-an-address',
      }),
    ).toBeNull()
    expect(resolveBaseSolanaBridgeSync({})).toBe(DEFAULT_BASE_SOLANA_BRIDGE)
  })
})
