// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WaitlistLeaderboardPanel } from './WaitlistLeaderboardPanel'

vi.mock('./LeaderboardIdentityCell', () => ({
  LeaderboardIdentityCell: ({ display }: { display: string }) => <span>{display}</span>,
}))

vi.mock('./useWaitlistLeaderboard', () => ({
  useWaitlistLeaderboardPreview: () => ({
    data: {
      totalCount: 42,
      leaderboard: [
        {
          rank: 1,
          signupId: 1,
          display: '@alpha',
          cswAddress: '0x0000000000000000000000000000000000000001',
          labelHint: null,
          avatarUrl: null,
          showZoraBadge: false,
          showBaseAppBadge: false,
          walletProvider: null,
          referralCode: null,
          pointsTotal: 500,
          pointsInvite: 10,
          pointsAgent: 0,
        },
      ],
      me: {
        rank: 5,
        signupId: 9,
        display: '@me',
        cswAddress: '0x0000000000000000000000000000000000000009',
        labelHint: null,
        avatarUrl: null,
        showZoraBadge: false,
        showBaseAppBadge: false,
        walletProvider: null,
        referralCode: 'ME',
        pointsTotal: 225,
        pointsInvite: 0,
        pointsAgent: 0,
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

function renderPanel(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('WaitlistLeaderboardPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('min-width: 1024px'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
  })

  it('renders rail leaderboard with your rank when not in preview list', () => {
    renderPanel(<WaitlistLeaderboardPanel layout="rail" />)
    expect(screen.getByLabelText('Waitlist leaderboard')).toBeTruthy()
    expect(screen.getByText('Your rank')).toBeTruthy()
    expect(screen.getAllByText('@me').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: /view full leaderboard/i })).toBeTruthy()
  })

  it('renders mobile collapsible leaderboard', () => {
    renderPanel(<WaitlistLeaderboardPanel layout="mobile" />)
    expect(screen.getByText('Leaderboard')).toBeTruthy()
    expect(screen.getByText('42 on waitlist')).toBeTruthy()
  })
})
