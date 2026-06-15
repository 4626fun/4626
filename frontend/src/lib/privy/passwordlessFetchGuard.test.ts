import { describe, expect, it } from 'vitest'

import {
  getPrivyPasswordlessBackoffMs,
  getPrivyPasswordlessFailureBackoffMs,
  getPrivyPasswordlessInitUrl,
  isPrivyPasswordlessFailure,
  isPrivyPasswordlessInitRequest,
  normalizeFetchMethod,
  rewritePrivyLegacyRequestInput,
  rewritePrivyLegacyRequestUrl,
} from './passwordlessFetchGuard'

describe('passwordlessFetchGuard', () => {
  it('matches Privy passwordless init requests only for POST', () => {
    const url = getPrivyPasswordlessInitUrl()
    expect(isPrivyPasswordlessInitRequest(url, 'POST')).toBe(true)
    expect(isPrivyPasswordlessInitRequest(url, 'post')).toBe(true)
    expect(isPrivyPasswordlessInitRequest(url, 'GET')).toBe(false)
    expect(isPrivyPasswordlessInitRequest('https://auth.privy.io/api/v1/analytics_events', 'POST')).toBe(false)
  })

  it('normalizes empty fetch methods to GET', () => {
    expect(normalizeFetchMethod(undefined)).toBe('GET')
    expect(normalizeFetchMethod('')).toBe('GET')
    expect(normalizeFetchMethod(' post ')).toBe('POST')
  })

  it('rewrites legacy Privy custom-domain API requests to auth.privy.io', () => {
    expect(rewritePrivyLegacyRequestUrl('https://privy.4626.fun/api/v1/passwordless/init')).toBe(
      'https://auth.privy.io/api/v1/passwordless/init',
    )
    expect(rewritePrivyLegacyRequestUrl('https://privy.4626.fun/healthz')).toBe('https://privy.4626.fun/healthz')
    expect(rewritePrivyLegacyRequestUrl('https://auth.privy.io/api/v1/passwordless/init')).toBe(
      'https://auth.privy.io/api/v1/passwordless/init',
    )
  })

  it('preserves Request inputs while rewriting legacy Privy URLs', () => {
    const request = new Request('https://privy.4626.fun/api/v1/passwordless/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.z' }),
    })
    const rewritten = rewritePrivyLegacyRequestInput(request)
    expect(rewritten.rewritten).toBe(true)
    expect(rewritten.url).toBe('https://auth.privy.io/api/v1/passwordless/init')
    expect(rewritten.input instanceof Request).toBe(true)
    expect((rewritten.input as Request).url).toBe('https://auth.privy.io/api/v1/passwordless/init')
    expect((rewritten.input as Request).method).toBe('POST')
  })

  it('uses retry-after seconds when Privy returns a rate limit header', () => {
    const response = new Response(null, {
      status: 429,
      headers: {
        'retry-after': '12',
      },
    })
    expect(getPrivyPasswordlessBackoffMs(response)).toBe(12_000)
  })

  it('falls back to the default cooldown when retry-after is absent', () => {
    const response = new Response(null, { status: 429 })
    expect(getPrivyPasswordlessBackoffMs(response)).toBe(30_000)
  })

  it('recognizes the rate-limit and browser-network failures Privy surfaces for OTP init', () => {
    expect(isPrivyPasswordlessFailure(new Error('Too many requests'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('Failed to fetch'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('No Access-Control-Allow-Origin header'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('something unrelated'))).toBe(false)
    expect(getPrivyPasswordlessFailureBackoffMs()).toBe(10_000)
  })
})
