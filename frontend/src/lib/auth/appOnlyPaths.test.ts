import { describe, expect, it } from 'vitest'

import { APP_ONLY_PATHS, isAppOnlyPath } from '@/lib/auth/appOnlyPaths'

describe('appOnlyPaths', () => {
  it('keeps account routes available cross-domain', () => {
    expect(APP_ONLY_PATHS).not.toContain('/account')
    expect(APP_ONLY_PATHS).not.toContain('/accounts')
    expect(APP_ONLY_PATHS).not.toContain('/settings')
  })

  it('does not mark account path as app-only', () => {
    expect(isAppOnlyPath('/account')).toBe(false)
    expect(isAppOnlyPath('/accounts')).toBe(false)
    expect(isAppOnlyPath('/settings')).toBe(false)
    expect(isAppOnlyPath('/home')).toBe(false)
    expect(isAppOnlyPath('/trade')).toBe(false)
    expect(isAppOnlyPath('/activate-akita')).toBe(false)
    expect(isAppOnlyPath('/dashboard')).toBe(false)
    expect(isAppOnlyPath('/launch')).toBe(false)
    expect(isAppOnlyPath('/positions')).toBe(false)
  })

  it('continues marking core app routes as app-only', () => {
    expect(isAppOnlyPath('/swap')).toBe(true)
    expect(isAppOnlyPath('/telegram/link')).toBe(true)
    expect(isAppOnlyPath('/deploy')).toBe(true)
    expect(isAppOnlyPath('/continue')).toBe(false)
    expect(isAppOnlyPath('/portfolio/0xabc')).toBe(false)
    expect(isAppOnlyPath('/alfaclub')).toBe(true)
    expect(isAppOnlyPath('/alfaclub/liquidity')).toBe(true)
    expect(isAppOnlyPath('/alfaclub/liquidity-pools')).toBe(true)
    expect(isAppOnlyPath('/alfaclub/trading-rooms')).toBe(true)
    expect(isAppOnlyPath('/alfaclub/trading-rooms/')).toBe(true)
    // After alfaclub.4626.fun cutover, key-safety is no longer a marketing override.
    expect(isAppOnlyPath('/alfaclub/key-safety')).toBe(true)
    expect(isAppOnlyPath('/alfaclub/key-safety/')).toBe(true)
    expect(isAppOnlyPath('/rooms')).toBe(false)
    expect(isAppOnlyPath('/safety')).toBe(false)
    expect(isAppOnlyPath('/pools')).toBe(false)
  })
})
