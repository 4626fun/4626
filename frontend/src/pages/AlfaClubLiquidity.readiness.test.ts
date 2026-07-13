import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import { getAlfaClubLiquidityDisabledReason } from './AlfaClubLiquidity'

const AKITA = getAddress('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
const SENDER = getAddress('0x3000000000000000000000000000000000000003')
const POOL = getAddress('0x2000000000000000000000000000000000000002')

function ready(overrides: Record<string, unknown> = {}) {
  return {
    factoryReady: true,
    creatorCoin: AKITA,
    tokenId: 1659n,
    executionAddress: SENDER,
    executionMode: 'canonical' as const,
    loading: false,
    snapshot: {
      pool: null,
      pairAllowed: true,
      creatorAllowed: true,
    },
    mode: 'create' as const,
    hasCreateAmount: true,
    ...overrides,
  }
}

describe('AlfaClub liquidity readiness', () => {
  it('fails closed with the exact factory readiness reason', () => {
    expect(getAlfaClubLiquidityDisabledReason(ready({ factoryReady: false }))).toBe(
      'Pool factory deployment is not configured',
    )
  })

  it('blocks closed create allowlists before transaction construction', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({ snapshot: { pool: null, pairAllowed: false, creatorAllowed: true } }),
      ),
    ).toBe('Pair allowlist is closed')
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({ snapshot: { pool: null, pairAllowed: true, creatorAllowed: false } }),
      ),
    ).toBe('Pool creator allowlist is closed')
  })

  it('limits canonical sponsorship to the verified room 1659 pair', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({ creatorCoin: getAddress('0x4000000000000000000000000000000000000004') }),
      ),
    ).toBe('Canonical sponsorship is limited to the verified room 1659 / AKITA pair')
  })

  it('keeps an existing pool usable after creation allowlists close', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: 'buy',
          snapshot: { pool: POOL, pairAllowed: false, creatorAllowed: false },
        }),
      ),
    ).toBeNull()
  })
})
