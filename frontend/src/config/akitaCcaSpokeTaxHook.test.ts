import { describe, expect, it } from 'vitest'

import { CCA_LAUNCH_CHAINS } from './ccaLaunchChains'
import {
  AKITA_CCA_SPOKE_TAX_HOOKS,
  BASE_SELL_TAX_HOOK,
  SELL_TAX_HOOK_CREATE2_DEPLOYER,
} from './akitaCcaSpokeTaxHook'

describe('akitaCcaSpokeTaxHook', () => {
  it('pins CREATE2 deployer and Base hub hook', () => {
    expect(SELL_TAX_HOOK_CREATE2_DEPLOYER).toBe('0x4e59b44847b379578588920cA78FbF26c0B4956C')
    expect(BASE_SELL_TAX_HOOK).toBe(CCA_LAUNCH_CHAINS.base.taxHook)
  })

  it('predicted addresses carry beforeSwap + beforeSwapReturnDelta flags (0x88)', () => {
    for (const pin of Object.values(AKITA_CCA_SPOKE_TAX_HOOKS)) {
      const flags = BigInt(pin.predicted) & 0x3fffn
      expect(flags).toBe(0x88n)
    }
  })

  it('matches ccaLaunchChains poolManager + wrappedNative per spoke', () => {
    for (const [key, pin] of Object.entries(AKITA_CCA_SPOKE_TAX_HOOKS)) {
      const chain = CCA_LAUNCH_CHAINS[key as keyof typeof CCA_LAUNCH_CHAINS]
      expect(chain.chainId).toBe(pin.chainId)
      expect(chain.poolManagerV4.toLowerCase()).toBe(pin.poolManager.toLowerCase())
      expect(chain.wrappedNative.toLowerCase()).toBe(pin.wrappedNative.toLowerCase())
    }
  })
})
