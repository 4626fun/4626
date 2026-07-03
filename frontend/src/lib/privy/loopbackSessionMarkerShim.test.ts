// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/flags/flags', () => ({
  isLocalDevOrigin: vi.fn(() => true),
}))

import { isLocalDevOrigin } from '@/lib/flags/flags'
import {
  applyLoopbackPrivySessionMarkerShim,
  assertPrivySessionMarkerCookie,
  clearPrivySessionMarkerCookie,
  isLocalDevPrivySessionMarkerMode,
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

  it('assert and clear helpers manage the marker cookie', () => {
    assertPrivySessionMarkerCookie()
    expect(document.cookie.includes('privy-session=t')).toBe(true)
    clearPrivySessionMarkerCookie()
    expect(document.cookie.includes('privy-session=t')).toBe(false)
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
})
