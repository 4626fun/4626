// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

vi.mock('@/hooks/useCreatorEconomySummary', () => ({
  useCreatorEconomySummary: () => ({
    loading: false,
    capabilities: {},
    view: {
      role: 'none',
      headline: 'No creator economy yet',
      statusLabel: 'No creator economy yet',
      statusDetail: null,
      networkLabel: 'Base',
      legacyBadge: null,
      showThreeTokenRail: false,
      railActive: false,
      primaryAction: { label: 'Launch or link coin', href: '/deploy/coin' },
      secondaryLink: null,
      showPaywall: false,
      metrics: { tvlUsd: null, sharePpsUsd: null, claimableCreatorEarningsEth: null },
      holder: null,
      launchAllocationLabel: '30% auction · 30% vesting · 30% Solana · 10% LP',
      strategyPlanLabel: null,
      infrastructureLabel: 'Base primary',
      accountSigningLabel: 'Ready',
      connectionsSummary: '0 of 7',
      nextConnectionBonus: { label: 'Connect Email', points: 10 },
      symbolDisplay: 'Creator',
      logoUrl: null,
      handleOrBasename: null,
      vaultHref: null,
      preferEconomyTab: false,
    },
  }),
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

vi.mock('@/lib/privy/safeHooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/privy/safeHooks')>()
  return {
    ...actual,
    useSafePrivy: () => ({ user: null, authenticated: false, ready: true }),
  }
})

vi.mock('@/lib/privy/walletHooksContext', () => ({
  usePrivyWalletsFromContext: () => [],
  usePrivyWalletsSnapshot: () => ({ wallets: [], ready: false }),
  usePrivyConnectWalletFromContext: () => undefined,
  usePrivySetActiveWalletFromContext: () => undefined,
}))

import { WaitlistAccountTray, type WaitlistAccountTrayProps } from './WaitlistAccountTray'

function renderTray(props: Partial<WaitlistAccountTrayProps> = {}) {
  const queryClient = new QueryClient()
  const defaults: WaitlistAccountTrayProps = {
    accountMe: null,
    accountMeLoading: false,
    joinedSessionAddress: '0x1111111111111111111111111111111111111111',
    externalEoaAddress: null,
    getPrivyAccessToken: async () => null,
    onRequestConnectWallet: vi.fn(),
    onRequestDisconnectMainWallet: vi.fn(),
    disconnectingMainWallet: false,
    onSignOut: vi.fn(),
    signOutBusy: false,
    signOutDisabled: false,
    identitiesPanel: <div data-testid="identities-panel">social identities + wizard</div>,
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

  it('shows a closed corner trigger and opens economy + collapsed account/connections', () => {
    renderTray()

    const trigger = screen.getByLabelText('Open account menu')
    expect(trigger).toBeTruthy()
    expect(screen.queryByTestId('identities-panel')).toBeNull()

    fireEvent.click(trigger)

    expect(screen.getByText(/no creator economy yet/i)).toBeTruthy()
    expect(screen.getByText(/account & signing/i)).toBeTruthy()
    expect(screen.getByText(/^connections$/i)).toBeTruthy()
    expect(screen.queryByTestId('identities-panel')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /connections/i }))
    expect(screen.getByTestId('identities-panel')).toBeTruthy()
    expect(screen.getByTestId('post-join-shell-stub')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /enter app/i })).toBeNull()
    expect(screen.getAllByRole('button', { name: /sign out/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('link', { name: /^help$/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^accounts$/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^settings$/i })).toBeTruthy()
  })

  it('auto-opens the tray once when a required setup step (wallet provisioning / owner-install signing) is pending', async () => {
    mockSetupRequired = true
    renderTray()

    // Effect-driven auto-open (rAF-deferred) — must not setState during render.
    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    })

    // Tray content is already visible without a click — the required step
    // must not be hidden behind a closed-by-default tray.
    expect(screen.getByText(/account & signing/i)).toBeTruthy()
    expect(screen.getByText(/no creator economy yet/i)).toBeTruthy()
  })

  it('disables sign out via the caller-provided aggregate busy flag', () => {
    renderTray({ signOutDisabled: true })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    const signOutButtons = screen.getAllByRole('button', { name: /sign out/i }) as HTMLButtonElement[]
    expect(signOutButtons.length).toBeGreaterThanOrEqual(1)
    for (const button of signOutButtons) {
      expect(button.disabled).toBe(true)
    }
  })
})
