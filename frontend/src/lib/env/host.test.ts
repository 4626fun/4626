import { describe, expect, it } from 'vitest'

import { resolveLoopbackOriginForCurrentWindow, resolveMarketingToAppBaseUrl } from '@/lib/env/host'

describe('resolveLoopbackOriginForCurrentWindow', () => {
  it('keeps configured origin for non-local hosts', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'https://4626.fun',
        currentOrigin: 'http://localhost:5174',
      }),
    ).toBe('https://4626.fun')
  })

  it('keeps configured origin when local host and port match', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173')
  })

  it('falls back to current origin when local host matches but port differs', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:5174',
      }),
    ).toBe('http://localhost:5174')
  })

  it('does not adopt random loopback ports outside the local allowlist', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:64254',
      }),
    ).toBe('http://localhost:5173')
  })
})

describe('resolveMarketingToAppBaseUrl', () => {
  it('keeps preferred app origin when it is public', () => {
    expect(
      resolveMarketingToAppBaseUrl({
        preferredAppOrigin: 'https://app.4626.fun',
        currentOrigin: 'https://4626.fun',
      }),
    ).toBe('https://app.4626.fun')
  })

  it('falls back to canonical public app origin when preferred origin is loopback on a public host', () => {
    expect(
      resolveMarketingToAppBaseUrl({
        preferredAppOrigin: 'http://localhost:5173',
        currentOrigin: 'https://4626.fun',
      }),
    ).toBe('https://app.4626.fun')
  })

  it('uses the current loopback origin while running locally', () => {
    expect(
      resolveMarketingToAppBaseUrl({
        preferredAppOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:5174',
      }),
    ).toBe('http://localhost:5174')
  })
})
