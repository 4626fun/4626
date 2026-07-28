// @vitest-environment happy-dom
import type { ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// `/waitlist` deliberately has no WagmiProvider (see AppQueryProvider.tsx and
// lib/privy/client.tsx). The waitlist tray must stay on wagmi-free shared tray
// modules — never import ConnectButton here. Mocking wagmi to throw on any
// call turns a regression into a hard test failure instead of a silent runtime
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

vi.mock('./useEmbeddedOwnerOnCsw', () => ({
  useEmbeddedOwnerOnCsw: () => ({
    isOwner: false,
    status: 'idle',
    needsInstall: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('./WaitlistPostJoinShell', () => ({
  WaitlistPostJoinShell: () => <div data-testid="post-join-shell-stub" />,
}))

vi.mock('@/hooks/useBasenameForAddress', () => ({
  useBasenameForAddress: () => ({ name: null, displayName: null, avatar: null, loading: false }),
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

import type { AccountSetupMe } from '@/features/accountSetup/types'
import { WaitlistAccountTray, type WaitlistAccountTrayProps } from './WaitlistAccountTray'

const emptyAccountMe: AccountSetupMe = {
  privyUserId: 'did:privy:test',
  email: null,
  emailVerified: false,
  appAccessStatus: null,
  baseSubAccount: null,
  linkedMethods: {},
  accountSignals: {
    linked: false,
    canonicalCswAddress: null,
    canonicalSource: null,
    baseSubAccount: {
      address: null,
      registered: false,
      isDistinctFromCsw: false,
    },
    executionTrack: 'none-yet',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
    creatorCoin: null,
    zoraHandle: null,
    basename: null,
    primaryWalletAddress: null,
    embeddedEoaAddress: null,
    lastResolvedAt: null,
  },
  score: { points: 0, tier: 0 },
}

function renderTray(props: Partial<WaitlistAccountTrayProps> = {}) {
  const queryClient = new QueryClient()
  const defaults: WaitlistAccountTrayProps = {
    accountMe: emptyAccountMe,
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

  it('shows a closed corner trigger and opens the same three-tab tray as the app', () => {
    renderTray()

    const trigger = screen.getByLabelText('Open account menu')
    expect(trigger).toBeTruthy()
    expect(screen.queryByTestId('identities-panel')).toBeNull()

    fireEvent.click(trigger)

    expect(screen.queryByText(/creator economy/i)).toBeNull()
    expect(screen.queryByText(/launch bundle/i)).toBeNull()
    expect(screen.getAllByText(/smart wallet/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/embedded signer/i)).toBeTruthy()
    expect(screen.getByText(/^main wallet$/i)).toBeTruthy()
    expect(screen.getByText(/^linked accounts$/i)).toBeTruthy()
    expect(screen.getByTestId('identities-panel')).toBeTruthy()
    expect(screen.getByTestId('post-join-shell-stub')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^wallets$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^portfolio$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^free entry$/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /enter app/i })).toBeNull()
    // Sign out lives in the shared footer (not duplicated in the wallets list).
    expect(screen.getByRole('button', { name: /^sign out$/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^help$/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^account$/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^settings$/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /^accounts$/i })).toBeNull()
  })

  it('does not mount wagmi AMOE entry on Free Entry; deep-links to the app', () => {
    renderTray()
    fireEvent.click(screen.getByLabelText('Open account menu'))
    fireEvent.click(screen.getByRole('button', { name: /^free entry$/i }))

    expect(screen.getByRole('link', { name: /enter free in the app/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /^official rules$/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^enter free$/i })).toBeNull()
  })

  it('does not flash smart-wallet needs-setup while account profile is still null', () => {
    renderTray({ accountMe: null, accountMeLoading: false })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    expect(screen.queryByText(/needs setup/i)).toBeNull()
    expect(screen.getByText(/embedded signer/i)).toBeTruthy()
  })

  it('shows the portfolio placeholder with enter-app CTA on the portfolio tab', () => {
    renderTray()
    fireEvent.click(screen.getByLabelText('Open account menu'))
    fireEvent.click(screen.getByRole('button', { name: /^portfolio$/i }))

    expect(screen.getByText(/token balances and activity are available in the app/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /enter app/i })).toBeTruthy()
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
    expect(screen.getByText(/embedded signer/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^wallets$/i })).toBeTruthy()
    expect(screen.queryByText(/creator economy/i)).toBeNull()
  })

  it('disables sign out via the caller-provided aggregate busy flag', () => {
    renderTray({ signOutDisabled: true })
    fireEvent.click(screen.getByLabelText('Open account menu'))

    const signOutButton = screen.getByRole('button', { name: /^sign out$/i }) as HTMLButtonElement
    expect(signOutButton.disabled).toBe(true)
  })
})
