import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { AKITA_DEFAULTS } from '@/config/contracts.defaults'

import {
  isAddressLikeSwapSymbol,
  isOpaqueInternalTokenLabel,
  resolveSwapTokenVerified,
  swapTokenOptionNeedsLabelEnrichment,
} from './swapTokenLabels'
import type { SwapTokenOption } from '@/components/swap/TokenSelectorModal'

describe('swapTokenLabels', () => {
  it('flags vault group ids as opaque internal labels', () => {
    expect(isOpaqueInternalTokenLabel('ed6fbda34f2614536df5cec08dff2266')).toBe(true)
    expect(isOpaqueInternalTokenLabel('')).toBe(true)
  })

  it('allows normal tickers and addresses', () => {
    expect(isOpaqueInternalTokenLabel('AKITA')).toBe(false)
    expect(isOpaqueInternalTokenLabel(getAddress(AKITA_DEFAULTS.token))).toBe(false)
    expect(isOpaqueInternalTokenLabel('Creator coin')).toBe(false)
  })

  it('detects truncated address placeholders as address-like symbols', () => {
    const address = getAddress(AKITA_DEFAULTS.token)
    expect(isAddressLikeSwapSymbol('0x5b67...fa75', address)).toBe(true)
    expect(isAddressLikeSwapSymbol('AKITA', address)).toBe(false)
  })

  it('treats zora creator/share tokens as verified unless explicitly marked false', () => {
    const address = getAddress(AKITA_DEFAULTS.token)
    expect(
      resolveSwapTokenVerified({
        address,
        symbol: 'AKITA',
        name: 'Akita',
        group: 'creator',
      }),
    ).toBe(true)
    expect(
      resolveSwapTokenVerified({
        address,
        symbol: '0x5b67...fa75',
        name: '0x5b67...fa75',
        group: 'creator',
      }),
    ).toBe(true)
    expect(
      resolveSwapTokenVerified({
        address,
        symbol: '0x5b67...fa75',
        name: '0x5b67...fa75',
        group: 'share',
        verified: false,
      }),
    ).toBe(false)
  })

  it('enriches mis-registered share stubs that still use address placeholders', () => {
    const address = getAddress(AKITA_DEFAULTS.token)
    const stub: SwapTokenOption = {
      address,
      symbol: '0x5b67...fa75',
      name: '0x5b67...fa75',
      group: 'share',
      verified: false,
    }
    expect(swapTokenOptionNeedsLabelEnrichment(stub)).toBe(true)
  })
})
