import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./trading.js', () => ({
  isObject: (v: unknown) => Boolean(v) && typeof v === 'object' && !Array.isArray(v),
  toCleanErrorMessage: (v: unknown, fallback: string) => {
    if (typeof v === 'string' && v) return v
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof (v as any).detail === 'string' && (v as any).detail) {
      return String((v as any).detail)
    }
    return fallback
  },
  uniswapTradeFetch: vi.fn(async () => ({ status: 200, payload: { ok: true } })),
}))

import { executeUniswapSkill } from './agentSkills'

describe('executeUniswapSkill policy', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ELIZA_UNISWAP_SKILLS_ENABLED
    delete process.env.ELIZA_UNISWAP_ALLOWED_SKILLS
    delete process.env.ELIZA_UNISWAP_REQUIRE_CONFIRMATION
  })

  it('blocks when globally disabled', async () => {
    process.env.ELIZA_UNISWAP_SKILLS_ENABLED = '0'
    await expect(executeUniswapSkill('uniswap_quote', {})).rejects.toThrow('disabled by policy')
  })

  it('enforces explicit confirmation on mutating skills', async () => {
    process.env.ELIZA_UNISWAP_REQUIRE_CONFIRMATION = '1'
    await expect(executeUniswapSkill('uniswap_liquidity', { chainId: 8453 })).rejects.toThrow('requires explicit confirmation')
  })

  it('allows safe read-only quote without confirmation', async () => {
    const result = await executeUniswapSkill('uniswap_quote', {
      tokenIn: '0x4200000000000000000000000000000000000006',
      tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      tokenInChainId: 8453,
      tokenOutChainId: 8453,
      amount: '1000',
      swapper: '0x1111111111111111111111111111111111111111',
      type: 'EXACT_INPUT',
    })
    expect(result).toHaveProperty('requestId')
    expect(result).toHaveProperty('data')
  })
})
