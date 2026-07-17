import { describe, expect, it } from 'vitest'

import {
  ALFACLUB_ARENA_PATH,
  ALFACLUB_EXPLORE_POOLS_PATH,
  ALFACLUB_EXPLORE_ROOMS_PATH,
  ALFACLUB_INVERSE_AKITA_PATH,
  ALFACLUB_POOLS_PATH,
  ALFACLUB_ROOMS_PATH,
  ALFACLUB_SAFETY_PATH,
  buildAlfaClubAbsoluteUrl,
  buildAlfaClubRedirectLocation,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'

describe('resolveAlfaClubCanonicalPath', () => {
  it('maps legacy and alias paths to short canonical routes', () => {
    expect(resolveAlfaClubCanonicalPath('/alfaclub')).toBe(ALFACLUB_EXPLORE_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/trading-rooms')).toBe(
      ALFACLUB_EXPLORE_ROOMS_PATH,
    )
    expect(resolveAlfaClubCanonicalPath('/trading-rooms/')).toBe(ALFACLUB_EXPLORE_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/key-safety')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/key-safety')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity')).toBe(ALFACLUB_EXPLORE_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity-pools')).toBe(ALFACLUB_EXPLORE_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/liquidity-pools')).toBe(ALFACLUB_EXPLORE_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/explore/rooms')).toBe(ALFACLUB_EXPLORE_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/explore/pools')).toBe(ALFACLUB_EXPLORE_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/inverseakita')).toBe(ALFACLUB_INVERSE_AKITA_PATH)
    expect(resolveAlfaClubCanonicalPath('/arena')).toBe(ALFACLUB_ARENA_PATH)
    expect(resolveAlfaClubCanonicalPath('/arena/positions')).toBe('/arena/positions')
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
    ).toBe('https://alfaclub.4626.fun/explore/pools?pool=0xabc')
  })

  it('forces the destination tab for safety and preserves pool filters for planner aliases', () => {
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
    ).toBe('/explore/pools?roomId=9&pool=0xabc')
  })
})
