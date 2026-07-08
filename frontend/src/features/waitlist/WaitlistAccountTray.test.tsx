// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// `/waitlist` deliberately has no WagmiProvider (see AppQueryProvider.tsx and
// lib/privy/client.tsx). If the tray — or anything it reuses from the app's
// `ConnectButton.tsx` tray pieces — ever calls a wagmi hook while rendering
// on this route, that's the exact extension-collision regression the
// wagmi-free adapter was built to avoid. Mocking wagmi to throw on any call
// turns that regression into a hard test failure instead of a silent runtime
// crash in production.
vi.mock('wagmi', () => ({
  useAccount: () => {
    throw new Error('wagmi useAccount must not be called while rendering the waitlist tray')
  },
  useConnect: () => {
    throw new Error('wagmi useConnect must not be called while rendering the waitlist tray')
  },
  useDisconnect: () => {
    throw new Error('wagmi useDisconnect must not be called while rendering the waitlist tray')
  },
}))

let mockSetupRequired = false

vi.mock('./useWaitlistPostJoinAttention', () => ({
  useWaitlistPostJoinAttention: () => ({
    setupRequired: mockSetupRequired,
  }),
}))

vi.mock('./WaitlistPostJoinShell', () => ({
  WaitlistPostJoinShell: () => <div data-testid="post-join-shell-stub" />,
}))

vi.mock('@/hooks/useBasenameForAddress', () => ({
  useBasenameForAddress: () => ({ name: null, displayName: null, avatar: null, loading: false }),
}))

vi.mock('@/hooks/useCreatorCoinBadge', () => ({
  useCreatorCoinBadge: () => null,
}))

vi.mock('@/lib/waitlist/accountTrayPoints', () => ({
  fetchAccountTrayPoints: vi.fn(async () => ({
    signupId: 0,
    tier: 0,
    leaderboardEligible: false,
    points: { total: 0, invite: 0, signup: 0, links: 0, tasks: 0, csw: 0, social: 0, checkins: 0, bonus: 0, agent: 0 },
    rank: { invite: null, total: null },
    totalCount: 0,
    activity: [],
  })),
  isAccountTrayPointsAuthError: () => false,
}))

import { WaitlistAccountTray, type WaitlistAccountTrayProps } from './WaitlistAccountTray'

function renderTray(props: Partial<WaitlistAccountTrayProps> = {}) {
  const queryClient = new QueryClient()
  const defaults: WaitlistAccountTrayProps = {
    accountMe: null,
    accountMeLoading: false,
    joinedSessionAddress: '0x1111111111111111111111111111111111111111',
    externalEoaAddress: null,
    appAccepted: true,
    getPrivyAccessToken: async () => null,
    onRequestConnectWallet: vi.fn(),
    onRequestDisconnectMainWallet: vi.fn(),
    disconnectingMainWallet: false,
    onSignOut: vi.fn(),
    signOutBusy: false,
    signOutDisabled: false,
    accountTabExtra: <div data-testid="account-tab-extra">linked accounts + wizard</div>,
  }
  const merged = { ...defaults, ...props }
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  return render(<WaitlistAccountTray {...merged} />, { wrapper: Wrapper })
}

describe('WaitlistAccountTray', () => {
  beforeEach(() => {
    mockSetupRequired = false
  })

  it('renders nothing when there is no joined waitlist session', () => {
    renderTray({ joinedSessionAddress: null })
    expect(screen.queryByLabelText('Open account menu')).toBeNull()
  })

  it('shows a closed corner trigger and opens the tray with the linked-accounts slot on click', () => {
    renderTray()

    const trigger = screen.getByLabelText('Open account menu')
    expect(trigger).toBeTruthy()
    expect(screen.queryByTestId('account-tab-extra')).toBeNull()

    fireEvent.click(trigger)

    expect(screen.getByTestId('account-tab-extra')).toBeTruthy()
    expect(screen.getByTestId('post-join-shell-stub')).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })

  it('only shows "Enter app" once the waitlist application has been accepted', () => {
    renderTray({ appAccepted: false })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    expect(screen.queryByRole('link', { name: /enter app/i })).toBeNull()
  })

  it('shows "Enter app" once accepted', () => {
    renderTray({ appAccepted: true })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    expect(screen.getByRole('link', { name: /enter app/i })).toBeTruthy()
  })

  it('auto-opens the tray once when a required setup step (wallet provisioning / owner-install signing) is pending', () => {
    mockSetupRequired = true
    renderTray()

    // Tray content is already visible without a click — the required step
    // must not be hidden behind a closed-by-default tray.
    expect(screen.getByTestId('account-tab-extra')).toBeTruthy()
  })

  it('disables sign out via the caller-provided aggregate busy flag', () => {
    renderTray({ signOutDisabled: true })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    const signOutButton = screen.getByRole('button', { name: /sign out/i }) as HTMLButtonElement
    expect(signOutButton.disabled).toBe(true)
  })
})
