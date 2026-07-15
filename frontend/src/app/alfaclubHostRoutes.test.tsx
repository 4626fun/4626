// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AlfaClubHubRedirect, RedirectPreserve } from '@/app/alfaclubHostRoutes'
import {
  ALFACLUB_EXPLORE_ROOMS_PATH,
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
          <Route
            path="/trading-rooms"
            element={<RedirectPreserve to={ALFACLUB_EXPLORE_ROOMS_PATH} />}
          />
          <Route path={ALFACLUB_EXPLORE_ROOMS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('location').textContent).toBe('/explore/rooms?roomId=9#top')
  })

  it('maps the full legacy redirect matrix to canonical short paths', () => {
    expect(resolveAlfaClubCanonicalPath('/alfaclub')).toBe(ALFACLUB_EXPLORE_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/trading-rooms')).toBe(
      ALFACLUB_EXPLORE_ROOMS_PATH,
    )
    expect(resolveAlfaClubCanonicalPath('/alfaclub/key-safety')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity')).toBe(ALFACLUB_ROOMS_PATH)
    expect(resolveAlfaClubCanonicalPath('/alfaclub/liquidity-pools')).toBe(ALFACLUB_ROOMS_PATH)

    expect(
      buildAlfaClubAbsoluteUrl({
        pathname: '/alfaclub/trading-rooms',
        search: '?roomId=1',
        origin: 'https://alfaclub.4626.fun',
      }),
    ).toBe('https://alfaclub.4626.fun/explore/rooms?roomId=1')
  })

  it('redirects safety into the room hub while preserving roomId and forcing its tab', () => {
    render(
      <MemoryRouter initialEntries={['/safety?roomId=1659&tab=overview#analysis']}>
        <Routes>
          <Route path={ALFACLUB_SAFETY_PATH} element={<AlfaClubHubRedirect />} />
          <Route path={ALFACLUB_ROOMS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('location').textContent).toBe('/rooms?roomId=1659&tab=safety#analysis')
  })

  it('redirects pools into room liquidity while preserving pool selection', () => {
    render(
      <MemoryRouter initialEntries={['/pools?roomId=9&pool=0xabc']}>
        <Routes>
          <Route path={ALFACLUB_POOLS_PATH} element={<AlfaClubHubRedirect />} />
          <Route path={ALFACLUB_ROOMS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('location').textContent).toBe(
      '/rooms?roomId=9&pool=0xabc&tab=liquidity',
    )
  })
})
