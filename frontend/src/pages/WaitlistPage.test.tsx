// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/lib/host', () => ({
  getHostMode: () => 'marketing',
  getMarketingBaseUrl: () => 'https://4626.fun',
}))

vi.mock('@/web3/Web3Providers', () => ({
  Web3Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/privy/client', () => ({
  PrivyClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/waitlist/ThinWaitlistFlow', () => ({
  ThinWaitlistFlow: ({ sectionId, autoStartAuth }: { sectionId?: string; autoStartAuth?: boolean }) => (
    <div data-testid="waitlist-flow" data-auto-start={autoStartAuth ? 'yes' : 'no'}>
      {sectionId ?? 'waitlist-flow'}
    </div>
  ),
}))

vi.mock('@/components/waitlist/PublicWaitlistOverview', () => ({
  PublicWaitlistOverview: ({
    onContinueWithEmail,
    referralCode,
  }: {
    onContinueWithEmail: () => void
    referralCode: string | null
  }) => (
    <div>
      <div>Sign up for the waitlist by verifying your email address.</div>
      <div>{referralCode ? `invite:${referralCode}` : 'invite:none'}</div>
      <button type="button" onClick={onContinueWithEmail}>
        Continue with email
      </button>
    </div>
  ),
}))

import { WaitlistInviteEntry } from './WaitlistInviteEntry'
import { WaitlistPage } from './WaitlistPage'

describe('WaitlistPage', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('keeps the provider-backed waitlist flow dormant on initial render', () => {
    render(
      <MemoryRouter initialEntries={['/waitlist']}>
        <WaitlistPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Sign up for the waitlist by verifying your email address.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeTruthy()
    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBeNull()
  })

  it('mounts the provider-backed waitlist flow only after explicit user intent', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/waitlist']}>
        <WaitlistPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'Continue with email' }))

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('yes')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBe('1')
  })

  it('consumes one-shot auto-start intent when arriving from an armed entry', async () => {
    window.sessionStorage.setItem('cv:waitlist:auth_armed', '1')
    window.sessionStorage.setItem('cv:waitlist:auth_auto_start', '1')

    render(
      <MemoryRouter initialEntries={['/waitlist']}>
        <WaitlistPage />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('yes')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_auto_start')).toBeNull()
  })

  it('captures invite routes and forwards into the single waitlist page', async () => {
    render(
      <MemoryRouter initialEntries={['/r/friend-42']}>
        <Routes>
          <Route path="/r/:referralCode" element={<WaitlistInviteEntry />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Sign up for the waitlist by verifying your email address.')).toBeTruthy()
    expect(screen.getByText('invite:FRIEND42')).toBeTruthy()
    expect(window.sessionStorage.getItem('cv:waitlist:referral_code')).toBe('FRIEND42')
  })
})
