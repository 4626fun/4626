import { describe, expect, it } from 'vitest'

import {
  evaluateSwapPolicyInput,
  evaluateSwapPolicyRouting,
  parseSwapPolicyFromEnv,
  shouldEnable7702CanaryForAddress,
} from './policy'

describe('parseSwapPolicyFromEnv', () => {
  it('uses permissive defaults when env is empty', () => {
    const policy = parseSwapPolicyFromEnv({})
    expect(policy.enabled).toBe(true)
    expect(policy.maxSlippageBps).toBeNull()
    expect(policy.maxInputBaseUnits).toBeNull()
    expect(policy.allowedRoutings).toBeNull()
    expect(policy.tokenAllowlist.size).toBe(0)
    expect(policy.tokenDenylist.size).toBe(0)
  })

  it('parses allow/deny lists and caps', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_MAX_SLIPPAGE_BPS: '300',
      VITE_UNISWAP_MAX_INPUT_BASE_UNITS: '1000',
      VITE_UNISWAP_ALLOWED_ROUTE_TYPES: 'CLASSIC,PRIORITY',
      VITE_UNISWAP_TOKEN_ALLOWLIST:
        '0x0000000000000000000000000000000000000001,0x0000000000000000000000000000000000000002',
      VITE_UNISWAP_TOKEN_DENYLIST: '0x0000000000000000000000000000000000000003',
    })
    expect(policy.maxSlippageBps).toBe(300)
    expect(policy.maxInputBaseUnits).toBe(1000n)
    expect(policy.allowedRoutings?.has('CLASSIC')).toBe(true)
    expect(policy.allowedRoutings?.has('PRIORITY')).toBe(true)
    expect(policy.tokenAllowlist.has('0x0000000000000000000000000000000000000001')).toBe(true)
    expect(policy.tokenDenylist.has('0x0000000000000000000000000000000000000003')).toBe(true)
  })
})

describe('evaluateSwapPolicyInput', () => {
  const tokenIn = '0x0000000000000000000000000000000000000001'
  const tokenOut = '0x0000000000000000000000000000000000000002'

  it('allows compliant swaps', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_MAX_SLIPPAGE_BPS: '500',
      VITE_UNISWAP_MAX_INPUT_BASE_UNITS: '1000000',
    })
    const decision = evaluateSwapPolicyInput({
      policy,
      tokenIn,
      tokenOut,
      amountBaseUnits: '100',
      slippageBps: 100,
    })
    expect(decision.allowed).toBe(true)
  })

  it('blocks denied token addresses', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_TOKEN_DENYLIST: tokenOut,
    })
    const decision = evaluateSwapPolicyInput({
      policy,
      tokenIn,
      tokenOut,
      amountBaseUnits: '10',
      slippageBps: 50,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('TOKEN_DENYLIST')
  })

  it('blocks slippage above configured max', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_MAX_SLIPPAGE_BPS: '75',
    })
    const decision = evaluateSwapPolicyInput({
      policy,
      tokenIn,
      tokenOut,
      amountBaseUnits: '10',
      slippageBps: 100,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('MAX_SLIPPAGE')
  })

  it('blocks amount above configured max', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_MAX_INPUT_BASE_UNITS: '9',
    })
    const decision = evaluateSwapPolicyInput({
      policy,
      tokenIn,
      tokenOut,
      amountBaseUnits: '10',
      slippageBps: 10,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('MAX_INPUT')
  })
})

describe('evaluateSwapPolicyRouting', () => {
  it('blocks routings that are not allowlisted', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_ALLOWED_ROUTE_TYPES: 'CLASSIC',
    })
    const decision = evaluateSwapPolicyRouting({
      policy,
      routing: 'PRIORITY',
    })
    expect(decision.allowed).toBe(false)
    expect(decision.code).toBe('ROUTING_NOT_ALLOWED')
  })
})

describe('shouldEnable7702CanaryForAddress', () => {
  it('requires global canary flag and allowlisted address when provided', () => {
    const policy = parseSwapPolicyFromEnv({
      VITE_UNISWAP_7702_CANARY_ENABLED: '1',
      VITE_UNISWAP_7702_CANARY_ALLOWLIST: '0x0000000000000000000000000000000000000001',
    })
    expect(shouldEnable7702CanaryForAddress(policy, '0x0000000000000000000000000000000000000001')).toBe(true)
    expect(shouldEnable7702CanaryForAddress(policy, '0x0000000000000000000000000000000000000002')).toBe(false)
  })
})
