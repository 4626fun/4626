import { afterEach, describe, expect, it } from 'vitest'

import {
  getAllowedUniswapChainIds,
  validateChainIdField,
  validateIntegerAmountField,
  validateRoutePolicy,
  validateTokenPolicy,
} from './guards'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key]
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('uniswap server guards policy', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('parses allowed chain ids from env', () => {
    process.env.UNISWAP_ALLOWED_CHAIN_IDS = '8453,10'
    const chains = getAllowedUniswapChainIds()
    expect(chains.has(8453)).toBe(true)
    expect(chains.has(10)).toBe(true)
  })

  it('validates chain ids against allowed set', () => {
    process.env.UNISWAP_ALLOWED_CHAIN_IDS = '8453'
    const payload: Record<string, unknown> = { chainId: 10 }
    expect(validateChainIdField(payload, 'chainId')).toBe('Unsupported chainId')
  })

  it('enforces max integer amount when configured', () => {
    process.env.UNISWAP_MAX_INPUT_BASE_UNITS = '100'
    const payload: Record<string, unknown> = { amount: '101' }
    expect(validateIntegerAmountField(payload, 'amount')).toMatch(/exceeds configured max/i)
  })

  it('enforces token denylist and allowlist', () => {
    process.env.UNISWAP_TOKEN_DENYLIST = '0x0000000000000000000000000000000000000001'
    process.env.UNISWAP_TOKEN_ALLOWLIST = '0x0000000000000000000000000000000000000002'

    expect(
      validateTokenPolicy(
        { tokenIn: '0x0000000000000000000000000000000000000001' },
        ['tokenIn'],
      ),
    ).toMatch(/denied/i)

    expect(
      validateTokenPolicy(
        { tokenIn: '0x0000000000000000000000000000000000000003' },
        ['tokenIn'],
      ),
    ).toMatch(/not allowlisted/i)
  })

  it('enforces allowed route policy when configured', () => {
    process.env.UNISWAP_ALLOWED_ROUTE_TYPES = 'CLASSIC,WRAP'
    expect(validateRoutePolicy('PRIORITY')).toMatch(/not allowed/i)
    expect(validateRoutePolicy('CLASSIC')).toBeNull()
  })
})
