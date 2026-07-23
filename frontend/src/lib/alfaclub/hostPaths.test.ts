import { describe, expect, it } from 'vitest'

import {
  ALFACLUB_EXPLORE_KEYS_PATH,
  ALFACLUB_EXPLORE_POOLS_PATH,
  ALFACLUB_KEYS_PATH,
  buildAlfaClubAbsoluteUrl,
  buildAlfaClubRedirectLocation,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'

describe('AlfaClub key path migration', () => {
  it('maps legacy room paths and canonical key/market surfaces', () => {
    expect(resolveAlfaClubCanonicalPath('/rooms')).toBe(ALFACLUB_KEYS_PATH)
    expect(resolveAlfaClubCanonicalPath('/explore/rooms')).toBe(ALFACLUB_EXPLORE_KEYS_PATH)
    expect(resolveAlfaClubCanonicalPath('/explore/pools')).toBe(ALFACLUB_EXPLORE_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/arena')).toBeNull()
    expect(resolveAlfaClubCanonicalPath('/inverseakita')).toBeNull()
    expect(resolveAlfaClubCanonicalPath('/h')).toBeNull()
  })

  it('moves roomId to keyId while preserving allowed query and hashes', () => {
    expect(buildAlfaClubRedirectLocation({ pathname: '/rooms', search: '?roomId=1659&tab=liquidity', hash: '#trade' }))
      .toBe('/keys?tab=liquidity&keyId=1659#trade')
    expect(buildAlfaClubAbsoluteUrl({ pathname: '/explore/rooms', search: '?sort=volume', origin: 'https://app.4626.fun' }))
      .toBe('https://app.4626.fun/explore/keys?sort=volume')
  })
})
