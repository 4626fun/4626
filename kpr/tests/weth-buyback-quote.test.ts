import { afterEach, describe, expect, it } from 'vitest'
import {
  assertWethBuybackPrivateSubmitReady,
  resolveWethBuybackRoute,
} from '../utils/wethBuybackQuote.js'

describe('weth buyback quote TTL + private submit gate', () => {
  const envKeys = [
    'KPR_WETH_BUYBACK_GAUGE',
    'KPR_WETH_BUYBACK_ROUTER',
    'KPR_WETH_BUYBACK_CALLDATA',
    'KPR_WETH_BUYBACK_AMOUNT',
    'KPR_WETH_BUYBACK_MIN_OUT',
    'KPR_WETH_BUYBACK_QUOTE_EXPIRES_AT_MS',
    'KPR_WETH_BUYBACK_QUOTE_ISSUED_AT_MS',
    'KPR_WETH_BUYBACK_QUOTE_MAX_AGE_MS',
    'KPR_WETH_BUYBACK_REQUIRE_PRIVATE_SUBMIT',
    'KPR_WETH_BUYBACK_PRIVATE_SUBMIT_CONFIRMED',
  ] as const
  const original = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]))

  function seedValidQuote(nowMs: number) {
    process.env.KPR_WETH_BUYBACK_GAUGE = '0x1111111111111111111111111111111111111111'
    process.env.KPR_WETH_BUYBACK_ROUTER = '0x2222222222222222222222222222222222222222'
    process.env.KPR_WETH_BUYBACK_CALLDATA = '0xdeadbeef'
    process.env.KPR_WETH_BUYBACK_AMOUNT = '1000000000000000000'
    process.env.KPR_WETH_BUYBACK_MIN_OUT = '1000'
    process.env.KPR_WETH_BUYBACK_QUOTE_ISSUED_AT_MS = String(nowMs)
    process.env.KPR_WETH_BUYBACK_QUOTE_EXPIRES_AT_MS = String(nowMs + 20_000)
    process.env.KPR_WETH_BUYBACK_QUOTE_MAX_AGE_MS = '30000'
  }

  afterEach(() => {
    for (const key of envKeys) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('resolves a fresh quote', () => {
    const now = 1_700_000_000_000
    seedValidQuote(now)
    const route = resolveWethBuybackRoute(now + 5_000)
    expect(route.wethAmount).toBe(1000000000000000000n)
    expect(route.minShareOftOut).toBe(1000n)
    expect(route.router).toBe('0x2222222222222222222222222222222222222222')
  })

  it('fails closed when quote expires', () => {
    const now = 1_700_000_000_000
    seedValidQuote(now)
    expect(() => resolveWethBuybackRoute(now + 25_000)).toThrow(/weth_buyback_quote_expired/)
  })

  it('fails closed when quote is stale beyond max age', () => {
    const now = 1_700_000_000_000
    seedValidQuote(now)
    process.env.KPR_WETH_BUYBACK_QUOTE_MAX_AGE_MS = '1000'
    process.env.KPR_WETH_BUYBACK_QUOTE_EXPIRES_AT_MS = String(now + 60_000)
    expect(() => resolveWethBuybackRoute(now + 5_000)).toThrow(/weth_buyback_quote_stale/)
  })

  it('requires private-submit confirmation by default', () => {
    delete process.env.KPR_WETH_BUYBACK_REQUIRE_PRIVATE_SUBMIT
    delete process.env.KPR_WETH_BUYBACK_PRIVATE_SUBMIT_CONFIRMED
    expect(() => assertWethBuybackPrivateSubmitReady()).toThrow(/weth_buyback_private_submit_unconfirmed/)
  })

  it('allows confirmed private submit', () => {
    process.env.KPR_WETH_BUYBACK_REQUIRE_PRIVATE_SUBMIT = '1'
    process.env.KPR_WETH_BUYBACK_PRIVATE_SUBMIT_CONFIRMED = '1'
    expect(() => assertWethBuybackPrivateSubmitReady()).not.toThrow()
  })
})
