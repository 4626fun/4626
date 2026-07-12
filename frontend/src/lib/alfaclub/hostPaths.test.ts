import { describe, expect, it } from 'vitest'

import {
  ALFACLUB_POOLS_PATH,
  ALFACLUB_ROOMS_PATH,
  ALFACLUB_SAFETY_PATH,
  buildAlfaClubAbsoluteUrl,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'

describe('resolveAlfaClubCanonicalPath', () => {
  it('maps legacy and alias paths to short canonical routes', () => {
    expect(resolveAlfaClubCanonicalPath('/alfaclub')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/trading-rooms')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/trading-rooms/')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/key-safety')).toBe(ALFACLUB_SAFETY_PATH)
    expect(resolveAlfaClubCanonicalPath('/key-safety')).toBe(ALFACLUB_SAFETY_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity')).toBe(ALFACLUB_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity-pools')).toBe(ALFACLUB_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/liquidity-pools')).toBe(ALFACLUB_POOLS_PATH)
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
    ).toBe('https://alfaclub.4626.fun/safety?roomId=42#panel')

    expect(
      buildAlfaClubAbsoluteUrl({
        pathname: '/alfaclub/liquidity-pools',
        search: '?pool=0xabc',
        origin: 'https://alfaclub.4626.fun',
      }),
    ).toBe('https://alfaclub.4626.fun/pools?pool=0xabc')
  })
})
