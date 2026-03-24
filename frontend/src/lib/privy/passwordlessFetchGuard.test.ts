import { describe, expect, it } from 'vitest'

import {
  getPrivyPasswordlessBackoffMs,
  getPrivyPasswordlessFailureBackoffMs,
  getPrivyPasswordlessInitUrl,
  isPrivyPasswordlessFailure,
  isPrivyPasswordlessInitRequest,
  normalizeFetchMethod,
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
