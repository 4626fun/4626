import { describe, expect, it } from 'vitest'

import {
  DEFAULT_BASE_SOLANA_BRIDGE,
  readBaseSolanaBridgeFromEnv,
  resolveBaseSolanaBridge,
  resolveBaseSolanaBridgeSync,
} from './resolveBaseSolanaBridge.ts'

describe('resolveBaseSolanaBridge', () => {
  it('prefers env override over adapter and default', async () => {
    const envBridge = '0x1111111111111111111111111111111111111111'
    const adapterBridge = '0x2222222222222222222222222222222222222222'
    const result = await resolveBaseSolanaBridge({
      env: { BASE_SOLANA_BRIDGE: envBridge },
      adapterAddress: '0x3333333333333333333333333333333333333333',
      publicClient: {
        readContract: async () => adapterBridge,
      },
    })
    expect(result).toEqual({ address: envBridge, source: 'env' })
  })

  it('reads BRIDGE from the SolanaBridgeAdapter when env is unset', async () => {
    const adapterBridge = '0x2222222222222222222222222222222222222222'
    const result = await resolveBaseSolanaBridge({
      env: {},
      adapterAddress: '0x3333333333333333333333333333333333333333',
      publicClient: {
        readContract: async ({ functionName }) => {
          if (functionName === 'BRIDGE') return adapterBridge
          throw new Error(`unexpected ${String(functionName)}`)
        },
      },
    })
    expect(result).toEqual({ address: adapterBridge, source: 'adapter' })
  })

  it('falls back to the SolanaBridgeAdapter.sol default constant', async () => {
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
