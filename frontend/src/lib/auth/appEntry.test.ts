import { describe, expect, it } from 'vitest'

import { APP_ENTRY_DEFAULT_NEXT, buildAppEntryPath, buildAppEntryUrl, readSafeNextPath } from './appEntry'

describe('appEntry helpers', () => {
  it('builds the canonical waitlist handoff path to the app landing route', () => {
    expect(buildAppEntryPath()).toBe('/continue')
  })

  it('builds a full app-entry URL from an origin', () => {
    expect(buildAppEntryUrl('https://v1.4626.fun')).toBe('https://v1.4626.fun/continue')
  })

  it('preserves an explicit non-default app destination with a minimal next query', () => {
    expect(buildAppEntryPath('/accounts')).toBe('/continue?next=%2Faccounts')
    expect(buildAppEntryUrl('https://v1.4626.fun', '/accounts')).toBe('https://v1.4626.fun/continue?next=%2Faccounts')
  })

  it('accepts safe internal paths for next routing', () => {
    expect(readSafeNextPath('/accounts')).toBe('/accounts')
    expect(readSafeNextPath('/deploy?tab=advanced')).toBe('/deploy?tab=advanced')
  })

  it('falls back to the canonical app landing route for unsafe values', () => {
    expect(readSafeNextPath('')).toBe(APP_ENTRY_DEFAULT_NEXT)
    expect(readSafeNextPath('accounts')).toBe(APP_ENTRY_DEFAULT_NEXT)
    expect(readSafeNextPath('https://evil.example/phish')).toBe(APP_ENTRY_DEFAULT_NEXT)
    expect(readSafeNextPath('//evil.example/phish')).toBe(APP_ENTRY_DEFAULT_NEXT)
  })
})
