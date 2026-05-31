import { describe, expect, it } from 'vitest'

import {
  getSwapProviderLabel,
  requiresCanonicalExecutionForSwapMode,
  resolveSwapProviderSelection,
  shouldFallbackToUniswap,
  shouldFallbackToZoraTrade,
} from './providerConfig'

describe('swap provider selection', () => {
  it('resolves uniswap mode defaults', () => {
    expect(resolveSwapProviderSelection('uniswap')).toEqual({
      mode: 'uniswap',
      primary: 'uniswap',
      fallback: null,
    })
  })

  it('resolves cdp mode without fallback', () => {
    expect(resolveSwapProviderSelection('cdp')).toEqual({
      mode: 'cdp',
      primary: 'cdp',
      fallback: null,
    })
  })

  it('resolves hybrid mode with uniswap fallback', () => {
    expect(resolveSwapProviderSelection('hybrid')).toEqual({
      mode: 'hybrid',
      primary: 'cdp',
      fallback: 'uniswap',
    })
  })
})

describe('swap provider guardrail helpers', () => {
  it('requires canonical execution in cdp and hybrid modes', () => {
    expect(requiresCanonicalExecutionForSwapMode('uniswap')).toBe(false)
    expect(requiresCanonicalExecutionForSwapMode('cdp')).toBe(true)
    expect(requiresCanonicalExecutionForSwapMode('hybrid')).toBe(true)
  })

  it('fallbacks only for retryable non-policy errors', () => {
    expect(shouldFallbackToUniswap(new Error('429 rate limit exceeded'))).toBe(true)
    expect(shouldFallbackToUniswap(new Error('forbidden by trusted origin policy'))).toBe(false)
    expect(shouldFallbackToUniswap(new Error('not authenticated'))).toBe(false)
  })

  it('exposes stable provider labels', () => {
    expect(getSwapProviderLabel('uniswap')).toBe('Uniswap')
    expect(getSwapProviderLabel('cdp')).toBe('CDP')
    expect(getSwapProviderLabel('zora')).toBe('Zora')
  })

  it('falls back to zora only for missing-route errors', () => {
    expect(shouldFallbackToZoraTrade(new Error('No route for pair'))).toBe(true)
    expect(shouldFallbackToZoraTrade(new Error('Insufficient token balance'))).toBe(false)
    expect(shouldFallbackToZoraTrade(new Error('not authenticated'))).toBe(false)
  })
})
