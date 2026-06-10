import { describe, expect, it } from 'vitest'

import {
  computeCounterTradeCooldownRemainingMs,
  resolveCounterTradeFillSourceWallet,
} from './counterTradeRunner.js'

describe('counterTradeRunner cooldown guard', () => {
  it('returns zero when no previous execution is known', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: null,
      cooldownMs: 120_000,
      nowMs: 1_000_000,
    })
    expect(remaining).toBe(0)
  })

  it('returns remaining cooldown when still inside cooldown window', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: 1_000_000,
      cooldownMs: 120_000,
      nowMs: 1_040_000,
    })
    expect(remaining).toBe(80_000)
  })

  it('returns zero once cooldown has elapsed', () => {
    const remaining = computeCounterTradeCooldownRemainingMs({
      lastExecutedAtMs: 1_000_000,
      cooldownMs: 120_000,
      nowMs: 1_130_000,
    })
    expect(remaining).toBe(0)
  })
})

describe('resolveCounterTradeFillSourceWallet', () => {
  it('uses dedicated room 1659 portfolio wallet policy', () => {
    const wallet = resolveCounterTradeFillSourceWallet({
      roomId: '1659',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      identityHlApiWalletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    expect(wallet).toBe('0xebf94fa19db7d2e7905decd01dae4ea9eb4c1ff2')
  })

  it('uses mapped hlApi wallet for non-1659 rooms when present', () => {
    const wallet = resolveCounterTradeFillSourceWallet({
      roomId: '1043',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      identityHlApiWalletAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })
    expect(wallet).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  })
})

