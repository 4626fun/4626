// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/host', () => ({
  getHostMode: () => 'marketing',
  getMarketingBaseUrl: () => 'https://4626.fun',
}))

import { WaitlistInviteEntry } from './WaitlistInviteEntry'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

describe('WaitlistInviteEntry', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('stores the referral code, arms waitlist auth, and redirects to waitlist', async () => {
    render(
      <MemoryRouter initialEntries={['/r/friend-42']}>
        <Routes>
          <Route path="/r/:referralCode" element={<WaitlistInviteEntry />} />
          <Route path="/waitlist" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    expect((await screen.findByTestId('location')).textContent).toBe('/waitlist')
    expect(window.sessionStorage.getItem('cv:waitlist:referral_code')).toBe('FRIEND42')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBe('1')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_auto_start')).toBe('1')
  })
})
