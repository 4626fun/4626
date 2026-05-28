import { getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

import {
  hasRecentZoraRouterSimulation,
  recordZoraRouterSimulationSuccess,
  resetZoraRouterSimulationCacheForTests,
} from './zoraRouterSimulationCache'

describe('zoraRouterSimulationCache', () => {
  const csw = getAddress('0xab6d5c10b03300326cd7fab7267ae192842967b5')
  const target = getAddress('0x6fF5693b99212Da76ad316178A184AB56D299b43')
  const data = '0x24856bc300000000000000000000000000000000000000000000000000000000' as const

  it('records and hits recent simulations', () => {
    resetZoraRouterSimulationCacheForTests()
    const now = 1_700_000_000_000
    recordZoraRouterSimulationSuccess({
      executionAddress: csw,
      target,
      data,
      value: 0n,
      now,
    })
    expect(
      hasRecentZoraRouterSimulation({
        executionAddress: csw,
        target,
        data,
        value: 0n,
        now: now + 1_000,
      }),
    ).toBe(true)
  })

  it('misses when calldata differs', () => {
    resetZoraRouterSimulationCacheForTests()
    recordZoraRouterSimulationSuccess({
      executionAddress: csw,
      target,
      data,
      value: 0n,
      now: 1_700_000_000_000,
    })
    expect(
      hasRecentZoraRouterSimulation({
        executionAddress: csw,
        target,
        data: '0xdead',
        value: 0n,
        now: 1_700_000_001_000,
      }),
    ).toBe(false)
  })
})
