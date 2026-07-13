// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/flags/flags', () => ({
  isLocalDevOrigin: vi.fn(() => true),
}))

import { isLocalDevOrigin } from '@/lib/flags/flags'
import {
  applyLoopbackPrivySessionMarkerShim,
  assertPrivySessionMarkerCookie,
  isLocalDevPrivySessionMarkerMode,
  PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT,
  resetPrivyLoopbackSessionAfterAuthFailure,
} from './loopbackSessionMarkerShim'

describe('loopbackSessionMarkerShim', () => {
  beforeEach(() => {
    document.cookie = 'privy-session=legacy; path=/'
    vi.mocked(isLocalDevOrigin).mockReturnValue(true)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'http://localhost:5174',
        hostname: 'localhost',
        protocol: 'http:',
      },
    })
  })

  afterEach(() => {
    document.cookie = 'privy-session=; path=/; max-age=0'
  })

  it('clears stale marker on localhost bootstrap instead of asserting it', () => {
    applyLoopbackPrivySessionMarkerShim()
    expect(document.cookie.includes('privy-session=t')).toBe(false)
  })

  it('keeps the marker absent on localhost when a persisted Privy session exists', () => {
    window.localStorage.setItem('privy:token', 'test-access-token')
    applyLoopbackPrivySessionMarkerShim()
    expect(document.cookie.includes('privy-session=t')).toBe(false)
    window.localStorage.removeItem('privy:token')
  })

  it('refuses to assert a server-cookie marker on localhost', () => {
    assertPrivySessionMarkerCookie()
    expect(document.cookie.includes('privy-session=t')).toBe(false)
  })

  it('asserts the marker for production custom-domain sessions', () => {
    vi.mocked(isLocalDevOrigin).mockReturnValue(false)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://4626.fun',
        hostname: '4626.fun',
        protocol: 'https:',
      },
    })

    assertPrivySessionMarkerCookie()

    expect(document.cookie.includes('privy-session=t')).toBe(true)
  })

  it('detects local dev marker mode on localhost', () => {
    expect(isLocalDevPrivySessionMarkerMode()).toBe(true)
  })

  it('clears deprecated Privy refresh storage on localhost bootstrap', () => {
    window.localStorage.setItem('privy:refresh_token', 'deprecated')
    window.localStorage.setItem('privy:token', 'stale')
    applyLoopbackPrivySessionMarkerShim()
    expect(window.localStorage.getItem('privy:refresh_token')).toBeNull()
    expect(window.localStorage.getItem('privy:token')).toBeNull()
  })

  describe('resetPrivyLoopbackSessionAfterAuthFailure', () => {
    it('unconditionally clears Privy storage even when refresh token is not "deprecated"', () => {
      window.localStorage.setItem('privy:refresh_token', 'a-real-looking-refresh-token')
      window.localStorage.setItem('privy:token', 'a-stale-access-token')
      resetPrivyLoopbackSessionAfterAuthFailure()
      expect(window.localStorage.getItem('privy:refresh_token')).toBeNull()
      expect(window.localStorage.getItem('privy:token')).toBeNull()
    })

    it('clears the marker cookie', () => {
      document.cookie = 'privy-session=t; path=/'
      expect(document.cookie.includes('privy-session=t')).toBe(true)
      resetPrivyLoopbackSessionAfterAuthFailure()
      expect(document.cookie.includes('privy-session=t')).toBe(false)
    })

    it('dispatches the session-expired event', () => {
      const listener = vi.fn()
      window.addEventListener(PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT, listener)
      resetPrivyLoopbackSessionAfterAuthFailure()
      window.removeEventListener(PRIVY_LOOPBACK_SESSION_EXPIRED_EVENT, listener)
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('does nothing outside local dev marker mode', () => {
      vi.mocked(isLocalDevOrigin).mockReturnValue(false)
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          origin: 'https://4626.fun',
          hostname: '4626.fun',
          protocol: 'https:',
        },
      })
      window.localStorage.setItem('privy:token', 'should-survive')
      resetPrivyLoopbackSessionAfterAuthFailure()
      expect(window.localStorage.getItem('privy:token')).toBe('should-survive')
      window.localStorage.removeItem('privy:token')
    })
  })
})
