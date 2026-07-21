// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RedirectPreserve } from '@/app/alfaclubHostRoutes'
import { ALFACLUB_EXPLORE_KEYS_PATH, ALFACLUB_KEYS_PATH } from '@/lib/alfaclub/hostPaths'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}{location.hash}</div>
}

describe('AlfaClub key path redirects', () => {
  it('normalizes roomId to keyId on the key detail path', () => {
    render(
      <MemoryRouter initialEntries={['/rooms?roomId=1659&tab=liquidity#trade']}>
        <Routes>
          <Route path="/rooms" element={<RedirectPreserve to={ALFACLUB_KEYS_PATH} />} />
          <Route path={ALFACLUB_KEYS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('location').textContent).toBe('/keys?tab=liquidity&keyId=1659#trade')
  })

  it('preserves explore filters while moving to the key directory', () => {
    render(
      <MemoryRouter initialEntries={['/explore/rooms?sort=volume#top']}>
        <Routes>
          <Route path="/explore/rooms" element={<RedirectPreserve to={ALFACLUB_EXPLORE_KEYS_PATH} />} />
          <Route path={ALFACLUB_EXPLORE_KEYS_PATH} element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('location').textContent).toBe('/explore/keys?sort=volume#top')
  })
})
