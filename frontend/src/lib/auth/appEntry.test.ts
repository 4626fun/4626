import { describe, expect, it } from 'vitest'

import { APP_ENTRY_DEFAULT_NEXT, buildAppEntryPath, buildAppEntryUrl, readSafeNextPath } from './appEntry'

describe('appEntry helpers', () => {
  it('builds the canonical waitlist handoff path to the app landing route', () => {
    expect(buildAppEntryPath()).toBe('/continue?from=waitlist&autologin=1&auth=wallet&next=%2Fswap')
  })

  it('builds a full app-entry URL from an origin', () => {
    expect(buildAppEntryUrl('https://app.4626.fun')).toBe(
      'https://app.4626.fun/continue?from=waitlist&autologin=1&auth=wallet&next=%2Fswap',
    )
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
