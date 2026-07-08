// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/flags/flags', () => ({
  isLocalDevOrigin: vi.fn(() => true),
}))

import { isLocalDevOrigin } from '@/lib/flags/flags'
import { PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT } from './loopbackSessionMarkerShim'
import { installPrivyLoopbackFetchRewrite } from './privyLoopbackFetchRewrite'

describe('installPrivyLoopbackFetchRewrite', () => {
  const originalFetch = window.fetch

  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.mocked(isLocalDevOrigin).mockReturnValue(true)
    delete (window as unknown as { __cvPrivyLoopbackFetchPatched?: boolean }).__cvPrivyLoopbackFetchPatched
    window.fetch = originalFetch
  })

  afterEach(() => {
    window.fetch = originalFetch
    vi.unstubAllEnvs()
  })

  it('rewrites privy.4626.fun API calls to auth.privy.io on local dev', async () => {
    const seen: string[] = []
    window.fetch = ((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      seen.push(url)
      return Promise.resolve(new Response('{}', { status: 200 }))
    }) as typeof fetch

    installPrivyLoopbackFetchRewrite()

    await window.fetch('https://privy.4626.fun/api/v1/passwordless/init', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@y.z' }),
    })

    expect(seen).toEqual(['https://auth.privy.io/api/v1/passwordless/init'])
  })

  it('installs only once', () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    window.fetch = fetchMock as typeof fetch

    installPrivyLoopbackFetchRewrite()
    installPrivyLoopbackFetchRewrite()

    expect(
      (window as unknown as { __cvPrivyLoopbackFetchPatched?: boolean }).__cvPrivyLoopbackFetchPatched,
    ).toBe(true)
  })

  it('strips custom_api_url from Privy app config on local dev', async () => {
    window.fetch = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'app', custom_api_url: 'https://privy.4626.fun' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )) as typeof fetch

    installPrivyLoopbackFetchRewrite()

    const response = await window.fetch('https://auth.privy.io/api/v1/apps/cmk411efm034jl50cs618o8cy')
    const payload = (await response.json()) as { custom_api_url?: string; id: string }

    expect(payload.id).toBe('app')
    expect(payload.custom_api_url).toBeUndefined()
  })

  it('resets stale Privy loopback session storage when siwe/link 401s on local dev', async () => {
    window.localStorage.setItem('privy:token', 'a-stale-access-token')
    window.fetch = (() => Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch

    installPrivyLoopbackFetchRewrite()

    const listener = vi.fn()
    window.addEventListener(PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT, listener)

    const response = await window.fetch('https://auth.privy.io/api/v1/siwe/link', {
      method: 'POST',
      body: JSON.stringify({ message: 'x', signature: '0x0' }),
    })

    window.removeEventListener(PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT, listener)

    expect(response.status).toBe(401)
    expect(window.localStorage.getItem('privy:token')).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('leaves other 401s from Privy alone', async () => {
    window.localStorage.setItem('privy:token', 'a-live-access-token')
    window.fetch = (() => Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch

    installPrivyLoopbackFetchRewrite()

    await window.fetch('https://auth.privy.io/api/v1/siwe/init', { method: 'POST' })

    expect(window.localStorage.getItem('privy:token')).toBe('a-live-access-token')
    window.localStorage.removeItem('privy:token')
  })

  it('no-ops deprecated server-cookie session refresh on local dev', async () => {
    const upstream = vi.fn(async () => new Response(null, { status: 500 }))
    window.fetch = upstream as typeof fetch

    installPrivyLoopbackFetchRewrite()

    const response = await window.fetch('https://auth.privy.io/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: 'deprecated' }),
    })
    const payload = (await response.json()) as { session_update_action?: string }

    expect(upstream).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(payload.session_update_action).toBe('ignore')
  })
})
