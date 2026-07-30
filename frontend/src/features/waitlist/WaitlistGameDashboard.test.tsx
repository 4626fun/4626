// @vitest-environment happy-dom

import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

function renderWithProviders(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

vi.mock('@/config/site', () => ({
  siteAssets: { logo: '/logo.png' },
}))

vi.mock('@/components/ui/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, data: null }),
  })),
}))

vi.mock('@/features/waitlist/LeaderboardIdentityCell', () => ({
  LeaderboardIdentityCell: ({ display }: { display: string }) => <span>{display}</span>,
}))

import { WaitlistGameDashboard } from './WaitlistGameDashboard'
import { WaitlistInviteCard } from './WaitlistInviteCard'
import { WaitlistJoinPanel } from './WaitlistJoinPanel'
import { WaitlistStatsRow } from './WaitlistStatsRow'
import { toast } from '@/components/ui/Toast'

describe('WaitlistGameDashboard', () => {
  it('renders HQ stats, invite, tasks, and mini leaderboard when joined', () => {
    renderWithProviders(
      <WaitlistGameDashboard
        appAccepted={false}
        greeting={<p>Welcome</p>}
        hq={{
          points: 42,
          rank: 7,
          referrals: 4,
          referralCode: 'GOLDCRS9',
          inviteUrl: 'https://4626.fun/r/GOLDCRS9',
          inviteDisplayPath: '4626.fun/r/GOLDCRS9',
          topRows: [
            {
              rank: 1,
              signupId: 1,
              display: 'alpha',
              cswAddress: null,
              eoaAddress: null,
              labelHint: null,
              avatarUrl: null,
              showZoraBadge: false,
              showBaseAppBadge: false,
              walletProvider: null,
              referralCode: 'A',
              pointsTotal: 100,
              pointsInvite: 10,
              pointsAgent: 0,
            },
          ],
          me: {
            rank: 7,
            signupId: 9,
            display: 'member',
            cswAddress: null,
            eoaAddress: null,
            labelHint: null,
            avatarUrl: null,
            showZoraBadge: false,
            showBaseAppBadge: false,
            walletProvider: null,
            referralCode: 'GOLDCRS9',
            pointsTotal: 42,
            pointsInvite: 4,
            pointsAgent: 0,
          },
          meOutsideTop: true,
          loading: false,
          statsUnavailable: false,
          inviteUnavailable: false,
        }}
        tasks={{
          twitterLinked: false,
          xPhaseDone: false,
          walletLinked: false,
          zoraLinked: false,
          activeStepKey: null,
          activeStep: null,
        }}
      />,
    )

    expect(screen.getByTestId('waitlist-game-dashboard')).toBeTruthy()
    expect(screen.getByTestId('waitlist-stats-row')).toBeTruthy()
    const stats = screen.getByLabelText('Your waitlist stats')
    expect(stats.textContent).toContain('42')
    expect(stats.textContent).toContain('#7')
    expect(screen.getByTestId('waitlist-invite-card')).toBeTruthy()
    expect(screen.getByText('Climb the list')).toBeTruthy()
    expect(screen.getByTestId('waitlist-mini-leaderboard')).toBeTruthy()
    expect(screen.getByText('you')).toBeTruthy() // "you" badge
  })
})

describe('WaitlistInviteCard', () => {
  it('copies the referral link and toasts', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(
      <WaitlistInviteCard
        inviteUrl="https://4626.fun/r/GOLDCRS9"
        displayPath="4626.fun/r/GOLDCRS9"
        referralCode="GOLDCRS9"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /copy referral link/i }))
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://4626.fun/r/GOLDCRS9')
      expect(toast.success).toHaveBeenCalledWith('Referral link copied')
    })
  })
})

describe('WaitlistJoinPanel', () => {
  it('renders campaign landing chrome and invite cue', () => {
    renderWithProviders(
      <WaitlistJoinPanel referralCode="FRIEND42">
        <button type="button">Join with email</button>
      </WaitlistJoinPanel>,
    )

    expect(screen.getByTestId('waitlist-join-panel')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Join the waitlist' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to 4626.fun' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /join with email/i })).toBeTruthy()
  })
})

describe('WaitlistStatsRow', () => {
  it('emphasizes points with tabular values', () => {
    render(<WaitlistStatsRow points={120} rank={3} referrals={8} />)
    expect(screen.getByText('120')).toBeTruthy()
    expect(screen.getByText('#3')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
  })
})
