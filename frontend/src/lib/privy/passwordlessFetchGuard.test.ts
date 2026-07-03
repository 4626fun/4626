import { describe, expect, it } from 'vitest'

import {
  getPrivyPasswordlessBackoffMs,
  getPrivyPasswordlessFailureBackoffMs,
  getPrivyPasswordlessInitUrl,
  isPrivyAppConfigRequest,
  isPrivyDeprecatedSessionRefreshRequest,
  isPrivyPasswordlessFailure,
  isPrivyPasswordlessInitRequest,
  normalizeFetchMethod,
  rewritePrivyLegacyRequestInput,
  rewritePrivyLegacyRequestUrl,
  sanitizePrivyAppConfigPayload,
} from './passwordlessFetchGuard'

describe('passwordlessFetchGuard', () => {
  it('matches Privy passwordless init requests only for POST', () => {
    const url = getPrivyPasswordlessInitUrl()
    expect(isPrivyPasswordlessInitRequest(url, 'POST')).toBe(true)
    expect(isPrivyPasswordlessInitRequest(url, 'post')).toBe(true)
    expect(isPrivyPasswordlessInitRequest(url, 'GET')).toBe(false)
    expect(isPrivyPasswordlessInitRequest('https://auth.privy.io/api/v1/analytics_events', 'POST')).toBe(false)
  })

  it('matches passwordless init on privy.4626.fun custom domain', () => {
    expect(isPrivyPasswordlessInitRequest('https://privy.4626.fun/api/v1/passwordless/init', 'POST')).toBe(true)
    expect(isPrivyPasswordlessInitRequest('https://privy.4626.fun/api/v1/passwordless/init', 'GET')).toBe(false)
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
    expect(rewritePrivyLegacyRequestUrl('https://privy.4626.fun/api/v1/sessions')).toBe(
      'https://auth.privy.io/api/v1/sessions',
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

  it('matches Privy app config GET requests', () => {
    expect(
      isPrivyAppConfigRequest('https://auth.privy.io/api/v1/apps/cmk411efm034jl50cs618o8cy', 'GET'),
    ).toBe(true)
    expect(
      isPrivyAppConfigRequest('https://auth.privy.io/api/v1/apps/cmk411efm034jl50cs618o8cy/clients', 'GET'),
    ).toBe(false)
    expect(
      isPrivyAppConfigRequest('https://auth.privy.io/api/v1/apps/cmk411efm034jl50cs618o8cy', 'POST'),
    ).toBe(false)
  })

  it('strips custom_api_url from Privy app config payloads', () => {
    const sanitized = sanitizePrivyAppConfigPayload({
      id: 'app',
      custom_api_url: 'https://privy.4626.fun',
    }) as { custom_api_url?: string; id: string }
    expect(sanitized.id).toBe('app')
    expect(sanitized.custom_api_url).toBeUndefined()
  })

  it('matches deprecated server-cookie session refresh POSTs only', () => {
    const url = 'https://auth.privy.io/api/v1/sessions'
    const deprecatedBody = JSON.stringify({ refresh_token: 'deprecated' })
    const realBody = JSON.stringify({ refresh_token: 'abc123' })
    expect(isPrivyDeprecatedSessionRefreshRequest(url, 'POST', deprecatedBody)).toBe(true)
    expect(isPrivyDeprecatedSessionRefreshRequest(url, 'POST', realBody)).toBe(false)
    expect(isPrivyDeprecatedSessionRefreshRequest(url, 'GET', deprecatedBody)).toBe(false)
  })

  it('recognizes the rate-limit and browser-network failures Privy surfaces for OTP init', () => {
    expect(isPrivyPasswordlessFailure(new Error('Too many requests'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('Failed to fetch'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('No Access-Control-Allow-Origin header'))).toBe(true)
    expect(isPrivyPasswordlessFailure(new Error('something unrelated'))).toBe(false)
    expect(getPrivyPasswordlessFailureBackoffMs()).toBe(10_000)
  })
})
