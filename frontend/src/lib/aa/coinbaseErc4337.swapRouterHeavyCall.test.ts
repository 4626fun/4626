import { describe, expect, it } from 'vitest'
import { getAddress, type Address, type Hex } from 'viem'

import { CONTRACTS } from '@/config/contracts'
import { isSwapRouterHeavyCall } from '@/lib/aa/coinbaseErc4337'

const ALFACLUB_UR = getAddress(CONTRACTS.alfaClubUniversalRouter) as Address
const ZORA_UR = '0x6ff5693b99212da76ad316178a184ab56d299b43' as Address
const EXECUTE = '0x3593564c0000000000000000000000000000000000000000000000000000000000000060' as Hex
const ZORA_EXECUTE = '0x24856bc30000000000000000000000000000000000000000000000000000000000000040' as Hex

describe('isSwapRouterHeavyCall', () => {
  it('treats AlfaClub Universal Router execute as swap-router-heavy', () => {
    expect(isSwapRouterHeavyCall({ to: ALFACLUB_UR, data: EXECUTE })).toBe(true)
  })

  it('still treats Zora Universal Router execute as swap-router-heavy', () => {
    expect(isSwapRouterHeavyCall({ to: ZORA_UR, data: ZORA_EXECUTE })).toBe(true)
    expect(isSwapRouterHeavyCall({ to: ZORA_UR, data: EXECUTE })).toBe(true)
  })

  it('ignores unrelated targets with the same selector', () => {
    expect(
      isSwapRouterHeavyCall({
        to: '0x0000000000000000000000000000000000000001' as Address,
        data: EXECUTE,
      }),
    ).toBe(false)
  })
})
