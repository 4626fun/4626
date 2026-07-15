import { describe, expect, it } from 'vitest'

import {
  ALFACLUB_POOLS_PATH,
  ALFACLUB_ROOMS_PATH,
  ALFACLUB_SAFETY_PATH,
  buildAlfaClubAbsoluteUrl,
  buildAlfaClubRedirectLocation,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'

describe('resolveAlfaClubCanonicalPath', () => {
  it('maps legacy and alias paths to short canonical routes', () => {
    expect(resolveAlfaClubCanonicalPath('/alfaclub')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/trading-rooms')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/trading-rooms/')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/key-safety')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/key-safety')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity-pools')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/liquidity-pools')).toBe(ALFACLUB_ROOMS_PATH)
  })

  it('returns null for unrelated paths', () => {
    expect(resolveAlfaClubCanonicalPath('/swap')).toBeNull()
    expect(resolveAlfaClubCanonicalPath('/rooms')).toBeNull()
  })
})

describe('buildAlfaClubAbsoluteUrl', () => {
  it('preserves query and hash on the AlfaClub origin', () => {
    expect(
      buildAlfaClubAbsoluteUrl({
        pathname: '/alfaclub/key-safety',
        search: '?roomId=42',
        hash: '#panel',
        origin: 'https://alfaclub.4626.fun',
      }),
    ).toBe('https://alfaclub.4626.fun/rooms?roomId=42&tab=safety#panel')

    expect(
      buildAlfaClubAbsoluteUrl({
        pathname: '/alfaclub/liquidity-pools',
        search: '?pool=0xabc',
        origin: 'https://alfaclub.4626.fun',
      }),
    ).toBe('https://alfaclub.4626.fun/rooms?pool=0xabc&tab=liquidity')
  })

  it('forces the destination tab while preserving room and pool state', () => {
    expect(
      buildAlfaClubRedirectLocation({
        pathname: ALFACLUB_SAFETY_PATH,
        search: '?roomId=1659&tab=liquidity',
      }),
    ).toBe('/rooms?roomId=1659&tab=safety')
    expect(
      buildAlfaClubRedirectLocation({
        pathname: ALFACLUB_POOLS_PATH,
        search: '?roomId=9&pool=0xabc',
      }),
    ).toBe('/rooms?roomId=9&pool=0xabc&tab=liquidity')
  })
})
