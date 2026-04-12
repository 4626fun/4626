import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  privyEnabledFlag,
  publicSiteModeFlag,
  lensGroveFlag,
  debugLogsFlag,
  privyAnalyticsFlag,
  injectedConnectorFlag,
  isPrivyHostModeAllowed,
  resolvePrivyClientId,
  resolvePrivyAppId,
  allFlags,
  resolveAllFlagValues,
  buildFlagDefinitions,
} from './featureFlags'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// isPrivyHostModeAllowed (unchanged semantics, now in featureFlags)
// ---------------------------------------------------------------------------

describe('isPrivyHostModeAllowed', () => {
  it('allows marketing host', () => {
    expect(isPrivyHostModeAllowed('marketing')).toBe(true)
  })

  it('allows app host', () => {
    expect(isPrivyHostModeAllowed('app')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resolvePrivyClientId / resolvePrivyAppId
// ---------------------------------------------------------------------------

describe('resolvePrivyClientId', () => {
  it('returns null when empty', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', '')
    expect(resolvePrivyClientId()).toBeNull()
  })

  it('returns configured value', () => {
    vi.stubEnv('VITE_PRIVY_CLIENT_ID', 'client_live_123')
    expect(resolvePrivyClientId()).toBe('client_live_123')
  })
})

describe('resolvePrivyAppId', () => {
  it('falls back to default when empty', () => {
    vi.stubEnv('VITE_PRIVY_APP_ID', '')
    expect(resolvePrivyAppId()).toBe('cmk411efm034jl50cs618o8cy')
  })

  it('returns configured value', () => {
    vi.stubEnv('VITE_PRIVY_APP_ID', 'custom_app_id')
    expect(resolvePrivyAppId()).toBe('custom_app_id')
  })
})

// ---------------------------------------------------------------------------
// privyEnabledFlag
// ---------------------------------------------------------------------------

describe('privyEnabledFlag', () => {
  it('is disabled by default (VITE_PRIVY_ENABLED not set)', () => {
    vi.stubEnv('VITE_PRIVY_ENABLED', '')
    expect(privyEnabledFlag()).toBe(false)
  })

  it('enables Privy on loopback origins in local dev', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_PRIVY_ENABLED', 'true')
    vi.stubEnv('VITE_PRIVY_ALLOWED_ORIGINS', 'https://4626.fun')
    vi.stubGlobal('window', {
      location: { origin: 'http://localhost:4173' },
    } as unknown as Window & typeof globalThis)
    const hostModule = await import('@/lib/host')
    const hostSpy = vi.spyOn(hostModule, 'getHostMode').mockReturnValue('marketing')
    expect(privyEnabledFlag()).toBe(true)
    hostSpy.mockRestore()
  })

  it('stays disabled for non-allowlisted non-loopback origins', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_PRIVY_ENABLED', 'true')
    vi.stubEnv('VITE_PRIVY_ALLOWED_ORIGINS', 'https://4626.fun')
    vi.stubGlobal('window', {
      location: { origin: 'https://preview.example.com' },
    } as unknown as Window & typeof globalThis)
    const hostModule = await import('@/lib/host')
    const hostSpy = vi.spyOn(hostModule, 'getHostMode').mockReturnValue('marketing')
    expect(privyEnabledFlag()).toBe(false)
    hostSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// publicSiteModeFlag
// ---------------------------------------------------------------------------

describe('publicSiteModeFlag', () => {
  it('returns false when unset', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_MODE', '')
    expect(publicSiteModeFlag()).toBe(false)
  })

  it('returns true for "1"', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_MODE', '1')
    expect(publicSiteModeFlag()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// lensGroveFlag
// ---------------------------------------------------------------------------

describe('lensGroveFlag', () => {
  it('defaults to true when unset', () => {
    vi.stubEnv('VITE_ENABLE_LENS_GROVE', '')
    expect(lensGroveFlag()).toBe(true)
  })

  it('returns false when "0"', () => {
    vi.stubEnv('VITE_ENABLE_LENS_GROVE', '0')
    expect(lensGroveFlag()).toBe(false)
  })

  it('returns true when "true"', () => {
    vi.stubEnv('VITE_ENABLE_LENS_GROVE', 'true')
    expect(lensGroveFlag()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// debugLogsFlag
// ---------------------------------------------------------------------------

describe('debugLogsFlag', () => {
  it('defaults to false', () => {
    vi.stubEnv('VITE_DEBUG_LOGS', '')
    expect(debugLogsFlag()).toBe(false)
  })

  it('returns true when "1"', () => {
    vi.stubEnv('VITE_DEBUG_LOGS', '1')
    expect(debugLogsFlag()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// privyAnalyticsFlag
// ---------------------------------------------------------------------------

describe('privyAnalyticsFlag', () => {
  it('defaults to false', () => {
    vi.stubEnv('VITE_PRIVY_ENABLE_ANALYTICS', '')
    vi.stubEnv('VITE_PRIVY_DISABLE_ANALYTICS', '')
    expect(privyAnalyticsFlag()).toBe(false)
  })

  it('returns true when enable is set', () => {
    vi.stubEnv('VITE_PRIVY_ENABLE_ANALYTICS', 'true')
    vi.stubEnv('VITE_PRIVY_DISABLE_ANALYTICS', '')
    expect(privyAnalyticsFlag()).toBe(true)
  })

  it('disable overrides enable', () => {
    vi.stubEnv('VITE_PRIVY_ENABLE_ANALYTICS', 'true')
    vi.stubEnv('VITE_PRIVY_DISABLE_ANALYTICS', 'true')
    expect(privyAnalyticsFlag()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// injectedConnectorFlag
// ---------------------------------------------------------------------------

describe('injectedConnectorFlag', () => {
  it('defaults to true', () => {
    vi.stubEnv('VITE_ENABLE_INJECTED_CONNECTOR', '')
    expect(injectedConnectorFlag()).toBe(true)
  })

  it('returns false when "0"', () => {
    vi.stubEnv('VITE_ENABLE_INJECTED_CONNECTOR', '0')
    expect(injectedConnectorFlag()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

describe('allFlags registry', () => {
  it('contains at least the core flags', () => {
    expect(allFlags.length).toBeGreaterThanOrEqual(8)
    const keys = allFlags.map((f) => f.definition.key)
    expect(keys).toContain('privy-enabled')
    expect(keys).toContain('lens-grove')
    expect(keys).toContain('debug-logs')
    expect(keys).toContain('host-mode')
  })
})

describe('resolveAllFlagValues', () => {
  it('returns an object keyed by flag key', () => {
    const values = resolveAllFlagValues()
    expect(typeof values).toBe('object')
    expect('privy-enabled' in values).toBe(true)
    expect('lens-grove' in values).toBe(true)
  })
})

describe('buildFlagDefinitions', () => {
  it('returns definitions with options and description', () => {
    const defs = buildFlagDefinitions()
    expect(defs['lens-grove']).toBeDefined()
    expect(defs['lens-grove']!.description).toContain('Lens Grove')
    expect(Array.isArray(defs['lens-grove']!.options)).toBe(true)
  })
})
