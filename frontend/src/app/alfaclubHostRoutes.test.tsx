// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RedirectPreserve } from '@/app/alfaclubHostRoutes'
import {
  ALFACLUB_POOLS_PATH,
  ALFACLUB_ROOMS_PATH,
  ALFACLUB_SAFETY_PATH,
  buildAlfaClubAbsoluteUrl,
  resolveAlfaClubCanonicalPath,
} from '@/lib/alfaclub/hostPaths'

function LocationProbe() {
  const location = useLocation()
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
      {location.hash}
    </div>
  )
}

describe('AlfaClub host path redirects', () => {
  it('preserves query and hash on same-host alias redirects', () => {
    render(
      <MemoryRouter initialEntries={['/trading-rooms?roomId=9#top']}>
        <Routes>
          <Route path="/trading-rooms" element={<RedirectPreserve to={ALFACLUB_ROOMS_PATH} />} />
          <Route path={ALFACLUB_ROOMS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('location').textContent).toBe('/rooms?roomId=9#top')
  })

  it('maps the full legacy redirect matrix to canonical short paths', () => {
    expect(resolveAlfaClubCanonicalPath('/alfaclub')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/trading-rooms')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/key-safety')).toBe(ALFACLUB_SAFETY_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity')).toBe(ALFACLUB_POOLS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity-pools')).toBe(ALFACLUB_POOLS_PATH)

    expect(
      buildAlfaClubAbsoluteUrl({
        pathname: '/alfaclub/trading-rooms',
        search: '?roomId=1',
        origin: 'https://alfaclub.4626.fun',
      }),
    ).toBe('https://alfaclub.4626.fun/rooms?roomId=1')
  })
})
