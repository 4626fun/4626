import { describe, expect, it } from 'vitest'

import { makeCooldownKey, makeDedupeKey } from '../actions/strategy-event-listener.action.js'

describe('strategy event listener keys', () => {
  it('builds normalized cooldown keys', () => {
    const out = makeCooldownKey({
      vaultAddress: '0xAbCd000000000000000000000000000000000001',
      strategyAddressOrPool: '0xEFab000000000000000000000000000000000002',
      actionType: 'strategy.ajna.rebucket',
    })
    expect(out).toBe(
      '0xabcd000000000000000000000000000000000001:0xefab000000000000000000000000000000000002:strategy.ajna.rebucket',
    )
  })

  it('builds dedupe keys using canonical schema', () => {
    const out = makeDedupeKey({
      vaultAddress: '0xABCD000000000000000000000000000000000001',
      strategyAddressOrPool: '0xEFAB000000000000000000000000000000000002',
      actionType: 'strategy.charm.rebalance',
      band: '123',
    })
    expect(out).toBe(
      'vault:0xabcd000000000000000000000000000000000001:strategy:0xefab000000000000000000000000000000000002:action:strategy.charm.rebalance:band:123',
    )
  })
})

