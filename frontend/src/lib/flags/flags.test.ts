import { afterEach, describe, expect, it, vi } from 'vitest'

import { getPrivyClientId, isPrivyClientEnabled, isPrivyHostModeAllowed } from '@/lib/flags/flags'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isPrivyHostModeAllowed', () => {
  it('keeps the Privy browser client available on the marketing host', () => {
    expect(isPrivyHostModeAllowed('marketing')).toBe(true)
  })

  it('keeps the Privy browser client available on the app host', () => {
    expect(isPrivyHostModeAllowed('app')).toBe(true)
  })
})

describe('getPrivyClientId', () => {
  it('returns null when no browser client id is configured', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', '')
    expect(getPrivyClientId()).toBeNull()
  })

  it('returns the configured Privy browser client id', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', 'client_live_123')
    expect(getPrivyClientId()).toBe('client_live_123')
  })
})

describe('isPrivyClientEnabled', () => {
  it('keeps Privy disabled on random loopback ports in local dev', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_PRIVY_ENABLED', 'true')
    vi.stubEnv('VITE_PRIVY_ALLOWED_ORIGINS', 'https://4626.fun')
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:63210' },
    } as unknown as Window & typeof globalThis)
    const hostModule = await import('@/lib/env/host')
    const hostSpy = vi.spyOn(hostModule, 'getHostMode').mockReturnValue('marketing')
    expect(isPrivyClientEnabled()).toBe(false)
    hostSpy.mockRestore()
  })

  it('enables Privy on explicitly allowlisted local dev origins', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_PRIVY_ENABLED', 'true')
    vi.stubEnv('VITE_PRIVY_ALLOWED_ORIGINS', 'http://localhost:5173 http://localhost:5174')
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:5173' },
    } as unknown as Window & typeof globalThis)
    const hostModule = await import('@/lib/env/host')
    const hostSpy = vi.spyOn(hostModule, 'getHostMode').mockReturnValue('app')
    expect(isPrivyClientEnabled()).toBe(true)
    hostSpy.mockRestore()
  })

  it('keeps Privy disabled for non-allowlisted non-loopback origins', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_PRIVY_ENABLED', 'true')
    vi.stubEnv('VITE_PRIVY_ALLOWED_ORIGINS', 'https://4626.fun')
    vi.stubGlobal('window', {
      location: { origin: 'https://preview.example.com' },
    } as unknown as Window & typeof globalThis)
    const hostModule = await import('@/lib/env/host')
    const hostSpy = vi.spyOn(hostModule, 'getHostMode').mockReturnValue('marketing')
    expect(isPrivyClientEnabled()).toBe(false)
    hostSpy.mockRestore()
  })
})
