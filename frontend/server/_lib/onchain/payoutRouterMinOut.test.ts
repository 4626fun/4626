import { describe, expect, it } from 'vitest'
import {
  deriveMinOutFromQuote,
  resolveHarvestMinCreatorOut,
  resolvePayoutRouterQuoterAddress,
  resolvePayoutRouterV3SlippageBps,
  type QuoterReader,
} from './payoutRouterMinOut'

const PATH = '0x1111111111166b7fe7bd91427724b487980afc69002710420000000000000000000000000000000000000006' as const

function quoterReturning(amountOut: bigint | Error): QuoterReader {
  return {
    readContract: async () => {
      if (amountOut instanceof Error) throw amountOut
      return [amountOut, [], [], 0n] as const
    },
  }
}

describe('resolvePayoutRouterV3SlippageBps', () => {
  it('defaults to 300 bps', () => {
    expect(resolvePayoutRouterV3SlippageBps({})).toBe(300)
  })

  it('reads PAYOUT_ROUTER_V3_SLIPPAGE_BPS', () => {
    expect(resolvePayoutRouterV3SlippageBps({ PAYOUT_ROUTER_V3_SLIPPAGE_BPS: '500' })).toBe(500)
  })

  it('rejects out-of-range or non-integer values', () => {
    expect(resolvePayoutRouterV3SlippageBps({ PAYOUT_ROUTER_V3_SLIPPAGE_BPS: '0' })).toBe(300)
    expect(resolvePayoutRouterV3SlippageBps({ PAYOUT_ROUTER_V3_SLIPPAGE_BPS: '5001' })).toBe(300)
    expect(resolvePayoutRouterV3SlippageBps({ PAYOUT_ROUTER_V3_SLIPPAGE_BPS: '2.5' })).toBe(300)
    expect(resolvePayoutRouterV3SlippageBps({ PAYOUT_ROUTER_V3_SLIPPAGE_BPS: 'abc' })).toBe(300)
  })
})

describe('resolvePayoutRouterQuoterAddress', () => {
  it('defaults to the Base QuoterV2 address', () => {
    expect(resolvePayoutRouterQuoterAddress({})).toBe('0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a')
  })

  it('honors env overrides in precedence order', () => {
    const override = '0x000000000000000000000000000000000000dEaD'
    expect(resolvePayoutRouterQuoterAddress({ PAYOUT_ROUTER_QUOTER_V2: override })).toBe(override)
    expect(resolvePayoutRouterQuoterAddress({ QUOTER: override })).toBe(override)
  })
})

describe('deriveMinOutFromQuote', () => {
  it('applies slippage in bps', () => {
    expect(deriveMinOutFromQuote(10_000n, 300)).toBe(9_700n)
    expect(deriveMinOutFromQuote(1_000_000n, 100)).toBe(990_000n)
  })

  it('never returns 0 for a nonzero quote', () => {
    expect(deriveMinOutFromQuote(1n, 5_000)).toBe(1n)
  })

  it('returns 0 for a zero quote', () => {
    expect(deriveMinOutFromQuote(0n, 300)).toBe(0n)
  })
})

describe('resolveHarvestMinCreatorOut', () => {
  it('derives min-out from the quote when available', async () => {
    const result = await resolveHarvestMinCreatorOut({
      publicClient: quoterReturning(10_000n),
      path: PATH,
      amountIn: 1_000n,
      configuredMinOut: 0n,
      env: {},
    })
    expect(result).toEqual({ ok: true, minCreatorOut: 9_700n, source: 'quote' })
  })

  it('keeps a higher configured floor over the derived value', async () => {
    const result = await resolveHarvestMinCreatorOut({
      publicClient: quoterReturning(10_000n),
      path: PATH,
      amountIn: 1_000n,
      configuredMinOut: 9_900n,
      env: {},
    })
    expect(result).toEqual({ ok: true, minCreatorOut: 9_900n, source: 'quote+floor' })
  })

  it('falls back to the configured floor when the quote fails', async () => {
    const result = await resolveHarvestMinCreatorOut({
      publicClient: quoterReturning(new Error('quote_failed')),
      path: PATH,
      amountIn: 1_000n,
      configuredMinOut: 123n,
      env: {},
    })
    expect(result).toEqual({ ok: true, minCreatorOut: 123n, source: 'floor' })
  })

  it('fails closed when no quote and no floor are available', async () => {
    const result = await resolveHarvestMinCreatorOut({
      publicClient: quoterReturning(new Error('quote_failed')),
      path: PATH,
      amountIn: 1_000n,
      configuredMinOut: 0n,
      env: {},
    })
    expect(result).toEqual({ ok: false, reason: 'min_out_unavailable' })
  })

  it('fails closed for an empty path', async () => {
    const result = await resolveHarvestMinCreatorOut({
      publicClient: quoterReturning(10_000n),
      path: '0x',
      amountIn: 1_000n,
      configuredMinOut: 0n,
      env: {},
    })
    expect(result).toEqual({ ok: false, reason: 'min_out_unavailable' })
  })
})
