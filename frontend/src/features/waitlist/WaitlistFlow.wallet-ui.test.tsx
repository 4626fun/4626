// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { apiFetch } from '@/lib/apiBase'

import { WaitlistFlow } from './WaitlistFlow'
import { WaitlistSetupWorkspace } from './WaitlistSetupWorkspace'

const collisionStateRef = vi.hoisted(() => ({
  current: {
    hasMultipleInjectedProviders: false,
    lockedEthereumProviderGlobal: false,
    persistedCollisionSignal: false,
    shouldDisableInjectedConnector: false,
  },
}))

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({
          children,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          whileInView: _whileInView,
          viewport: _viewport,
          ...props
        }: any) => React.createElement(tag, props, children),
    },
  ),
}))

let mockPrivyAuthenticated = true
const mockGetAccessToken = vi.fn<() => Promise<string | null>>(async () => 'privy-token-default')
const mockPrivyLogout = vi.fn(async () => undefined)
const mockLinkEmail = vi.fn(async () => undefined)
const mockLogin = vi.fn(async () => undefined)
const mockPrivyHookState = {
  wallet: undefined as unknown,
  wallets: [] as unknown[],
}
const mockWagmiPublicClient = {
  readContract: async () => true,
}
const mockWagmiSwitchChain = {
  switchChainAsync: async () => undefined,
}
const mockWagmiWalletClientState = {
  data: null as unknown,
}

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: mockPrivyAuthenticated,
    getAccessToken: mockGetAccessToken,
    logout: mockPrivyLogout,
    linkEmail: mockLinkEmail,
  }),
  useLogin: () => ({ login: mockLogin }),
  useConnectWallet: () => ({ connectWallet: () => undefined }),
  useCrossAppAccounts: () => ({
    loginWithCrossAppAccount: async () => undefined,
    linkCrossAppAccount: async () => undefined,
  }),
  useActiveWallet: () => ({ wallet: mockPrivyHookState.wallet }),
  useWallets: () => ({ wallets: mockPrivyHookState.wallets }),
}))

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useAccount: () => ({ chainId: 8453, address: '0x1111111111111111111111111111111111111111' }),
    usePublicClient: () => mockWagmiPublicClient,
    useSwitchChain: () => mockWagmiSwitchChain,
    useWalletClient: () => mockWagmiWalletClientState,
    WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/lib/apiBase', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/host', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/host')>()
  return {
    ...actual,
    getAppBaseUrl: () => 'https://app.4626.fun',
    getMarketingBaseUrl: () => 'https://4626.fun',
    getWaitlistReferralBaseUrl: () => 'https://4626.fun',
  }
})

vi.mock('@/lib/privy/client', () => ({
  ZORA_PRIVY_APP_ID: 'test-zora-app-id',
  usePrivyClientStatus: () => 'ready',
}))

vi.mock('@/lib/privy/embeddedWallet', () => ({
  extractPrivyWalletsFromUser: () => [],
  useEnsurePrivyEmbeddedWallet: () => ({
    ensureEmbeddedWallet: async () => ({ address: '0x0000000000000000000000000000000000000042' }),
  }),
}))

vi.mock('@/lib/privy/zoraCrossApp', () => ({
  performZoraCrossAppAuth: async () => undefined,
}))

vi.mock('@/hooks/siweAuthCrossApp', () => ({
  isPrivyRedirectUrlNotAllowedError: () => false,
  sanitizeCrossAppRedirectUrlForAuth: () => '',
}))

vi.mock('@/lib/wallet/providerCollision', () => ({
  detectEthereumProviderCollision: () => collisionStateRef.current,
}))

vi.mock('@/components/ui/StepIndicator', () => ({
  StepIndicator: () => <div data-testid="step-indicator" />,
}))

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

const WAITLIST_ACCOUNT = {
  privyUserId: 'did:privy:test-user',
  email: 'waitlisted@example.com',
  emailVerified: true,
  appAccessStatus: 'pending',
  linkedMethods: { email: ['waitlisted@example.com'] },
  accountSignals: {
    linked: true,
    canonicalCswAddress: '0x1111111111111111111111111111111111111111',
    creatorCoin: null,
    zoraHandle: null,
    lastResolvedAt: null,
  },
  score: {
    points: 1234,
    tier: 1,
  },
}

const WAITLIST_BOOTSTRAP_PAYLOAD = {
  success: true,
  data: {
    requiresPrivyAuth: false,
    ...WAITLIST_ACCOUNT,
  },
}

describe('WaitlistFlow simplified completion UI', () => {
  beforeEach(() => {
    mockPrivyAuthenticated = true
    collisionStateRef.current = {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      persistedCollisionSignal: false,
      shouldDisableInjectedConnector: false,
    }
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockResolvedValue('privy-token-default')
    mockPrivyLogout.mockReset()
    mockPrivyLogout.mockResolvedValue(undefined)
    mockLinkEmail.mockReset()
    mockLinkEmail.mockResolvedValue(undefined)
    mockLogin.mockReset()
    mockLogin.mockResolvedValue(undefined)

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/handoff/create')) {
        return jsonResponse({
          success: true,
          data: { code: 'handoff-code', expiresAt: '2099-01-01T00:00:00.000Z' },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })
  })

  it('shows streamlined completion actions for verified waitlisted users', async () => {
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/activate your account/i)).toBeTruthy()
    expect(screen.getByText(/step 2 of 2/i)).toBeTruthy()
    expect(screen.queryByText(/climb the waitlist/i)).toBeNull()
    expect(screen.queryByText(/waitlist leaderboard/i)).toBeNull()
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([input]) => String(input).startsWith('/api/waitlist/position')),
    ).toBe(false)
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([input]) => String(input).startsWith('/api/waitlist/leaderboard')),
    ).toBe(false)
  })

  it('keeps auth state to a single heading stack', () => {
    mockPrivyAuthenticated = false
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        return jsonResponse({
          success: true,
          data: {
            requiresPrivyAuth: true,
            email: null,
            waitlistEntryId: null,
          },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /^start with email$/i })).toBeTruthy()
    expect(
      screen.queryByText(/one secure email sign-in saves your spot\. then we guide you through setup in a few clear steps\./i),
    ).toBeNull()
  })

  it('renders a setup-first workspace for verified users instead of a CTA-only completion state', async () => {
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/link your zora identity/i)).toBeTruthy()
    expect(screen.getByText(/enable 4626 signing/i)).toBeTruthy()
    // Completed steps render a "Done" pill
    expect(screen.getAllByText(/^done$/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /approve signing access|connect owner wallet/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^retry$/i })).toBeTruthy()
  })

  it('shows a single setup title after entering the waitlist setup workspace', async () => {
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /activate your account/i })).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: /activate your account/i })).toHaveLength(1)
  })

  it('keeps waitlist workspace focused and hides advanced settings action', async () => {
    const openAccounts = vi.fn()

    render(
      <MemoryRouter>
        <WaitlistSetupWorkspace
          initialAccount={WAITLIST_ACCOUNT as any}
          canEnterApp={false}
          completionBusy={false}
          onEnterApp={vi.fn()}
          onOpenAccounts={openAccounts}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/activate your account/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /advanced account settings/i })).toBeNull()
    expect(openAccounts).toHaveBeenCalledTimes(0)
  })

  it('hides enter app until all setup steps are complete', async () => {
    render(
      <MemoryRouter>
        <WaitlistSetupWorkspace
          initialAccount={WAITLIST_ACCOUNT as any}
          canEnterApp
          completionBusy={false}
          onEnterApp={vi.fn()}
          onOpenAccounts={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/activate your account/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /enter app/i })).toBeNull()
  })

  it('shows manual existing-account recovery when bootstrap returns recovery-required', async () => {
    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(
          {
            success: false,
            code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
            error: 'Recovery required',
            recoveryRequired: true,
          },
          false,
          409,
        ) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    const continueButton = await screen.findByRole('button', { name: /^continue$/i }, { timeout: 6_000 })
    fireEvent.click(continueButton)

    expect(
      await screen.findByText(/this email already has a 4626 account/i, undefined, { timeout: 5_000 }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /try existing account sign-in/i })).toBeTruthy()
    expect(mockLogin).toHaveBeenCalledTimes(0)
    expect(mockPrivyLogout).toHaveBeenCalledTimes(0)
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
  })

  it('hands off into accounts when user taps existing-account sign-in', async () => {
    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(
          {
            success: false,
            code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
            error: 'Recovery required',
            recoveryRequired: true,
          },
          false,
          409,
        ) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/handoff/create')) {
        return jsonResponse({ success: true, data: { code: 'handoff-code', expiresAt: '2099-01-01T00:00:00.000Z' } }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'http://localhost:5173',
        href: 'http://localhost:5173/waitlist',
        assign: vi.fn(),
      },
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }))
    const recoverButton = await screen.findByRole('button', { name: /try existing account sign-in/i }, { timeout: 5_000 })
    fireEvent.click(recoverButton)

    await waitFor(() => {
      expect(
        vi
          .mocked(apiFetch)
          .mock.calls.some(([input]) => String(input).startsWith('/api/auth/handoff/create')),
      ).toBe(true)
    }, { timeout: 5_000 })
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
    expect(mockPrivyLogout).toHaveBeenCalledTimes(0)

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('retries session-finalizing bootstrap and advances without manual second tap', async () => {
    let bootstrapCalls = 0
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue('privy-token-finalized')

    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/activate your account/i, undefined, { timeout: 7_000 })).toBeTruthy()
    // Scheduler keeps retries bounded while still allowing completion.
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(bootstrapCalls).toBeLessThanOrEqual(3)
    expect(screen.queryByText(/sign-in session is still finalizing/i)).toBeNull()
  })

  it('handles delayed token hydration when privy auth flag is still false', async () => {
    let bootstrapCalls = 0
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue('privy-token-delayed')

    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/activate your account/i, undefined, { timeout: 9_000 })).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
    expect(screen.queryByText(/sign-in session is still finalizing/i)).toBeNull()
  })

  it('auto-retries from finalizing state without requiring manual re-click', async () => {
    let bootstrapCalls = 0
    let activeToken: string | null = null
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockImplementation(async () => activeToken)
    mockLogin.mockReset()
    mockLogin.mockImplementation(async () => {
      setTimeout(() => {
        activeToken = 'privy-token-after-finalizing'
      }, 1000)
      return undefined
    })

    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/activate your account/i, undefined, { timeout: 10_000 })).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('does not call auth/logout before opening email login', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValue('privy-token-after-login')

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1)
    }, { timeout: 5_000 })

    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([input]) => String(input).startsWith('/api/auth/logout')),
    ).toBe(false)
  })

  it('recovers when Privy rejects login because a session already exists', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('privy-token-existing-session')
    mockLogin.mockReset()
    mockLogin.mockRejectedValue(
      new Error('Attempted to log in, but user is already logged in. Use a `link` helper instead.'),
    )

    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/activate your account/i, undefined, { timeout: 9_000 })).toBeTruthy()
    expect(mockLogin).toHaveBeenCalledTimes(1)
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('surfaces a fresh-retry message when stale Privy session reset still yields no token', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(null)
    mockPrivyLogout.mockReset()
    mockPrivyLogout.mockResolvedValue(undefined)
    mockLogin.mockReset()
    mockLogin
      .mockRejectedValueOnce(new Error('Attempted to log in, but user is already logged in. Use a `link` helper instead.'))
      .mockResolvedValueOnce(undefined)

    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(
      await screen.findByText(/sign-in got stuck in an old session/i, undefined, { timeout: 9_000 }),
    ).toBeTruthy()
    expect(mockPrivyLogout).toHaveBeenCalledTimes(1)
    expect(mockLogin).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(/sign-in session is still finalizing/i)).toBeNull()
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeTruthy()
  })

  it('avoids bootstrap bursts while auth=true and token is still null', async () => {
    mockPrivyAuthenticated = true
    let bootstrapCalls = 0
    let tokenReads = 0

    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockImplementation(async () => {
      tokenReads += 1
      if (tokenReads <= 6) return null
      return 'privy-token-hydrated'
    })

    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/activate your account/i, undefined, { timeout: 9_000 })).toBeTruthy()
    // No token means no bootstrap burst; once token hydrates we should only need one tokened bootstrap.
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
  })

  it('keeps requiresPrivyAuth bootstrap retries bounded when auth is true', async () => {
    mockPrivyAuthenticated = true
    let bootstrapCalls = 0
    let tokenReads = 0

    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockImplementation(async () => {
      tokenReads += 1
      if (tokenReads <= 2) return 'privy-token-ready'
      return 'privy-token-after-gate'
    })

    vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        if (bootstrapCalls === 1) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        const headers = (init?.headers ?? {}) as Record<string, string | undefined>
        const token = headers['X-Privy-Token'] ?? headers['x-privy-token']
        if (!token) {
          return jsonResponse({
            success: true,
            data: {
              requiresPrivyAuth: true,
              email: 'waitlisted@example.com',
              waitlistEntryId: 77,
            },
          }) as any
        }
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /^start with email$/i }, { timeout: 9_000 })).toBeTruthy()
    // first requiresPrivyAuth + optional cooldown-respected retry to recover
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(bootstrapCalls).toBeLessThanOrEqual(3)
  })

  it('opens a recovery circuit breaker when bootstrap keeps returning recovery-required', async () => {
    mockPrivyAuthenticated = true
    let bootstrapCalls = 0
    let logoutCalls = 0

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(
          {
            success: false,
            code: 'RECOVERY_REQUIRED_EMAIL_BOUND',
            error: 'Recovery required',
            recoveryRequired: true,
          },
          false,
          200,
        ) as any
      }
      if (input.startsWith('/api/auth/logout')) {
        logoutCalls += 1
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 6_000 })

    // Allow async retries to settle, then verify calls stay bounded (no ongoing spam loop).
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    const settledBootstrapCalls = bootstrapCalls
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    expect(bootstrapCalls).toBeLessThanOrEqual(settledBootstrapCalls + 1)

    // one initial bootstrap + at most one recovery bootstrap probe
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
    expect(logoutCalls).toBeLessThanOrEqual(1)
  })

  it('fails fast on wallet-provider collision instead of entering finalizing retries', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockResolvedValue(null)
    mockLogin.mockReset()
    mockLogin.mockRejectedValue(
      new Error('Cannot set property ethereum of #<window> which has only a getter'),
    )

    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(
      await screen.findByText(/browser wallet extension is interfering with sign-in/i, undefined, {
        timeout: 3_000,
      }),
    ).toBeTruthy()
    expect(screen.queryByText(/sign-in session is still finalizing/i)).toBeNull()
    expect(bootstrapCalls).toBe(0)
  })

  it('does not let a persisted wallet collision signal block email-only waitlist auth', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken
      .mockResolvedValueOnce(null)
      .mockResolvedValue('privy-token-after-login')
    collisionStateRef.current = {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      persistedCollisionSignal: true,
      shouldDisableInjectedConnector: true,
    }

    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /continue/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1)
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 3_000 })
    expect(screen.queryByText(/browser wallet extension is interfering with sign-in/i)).toBeNull()
  })

  it('releases busy lock when login hangs and surfaces a retryable timeout', async () => {
    vi.useFakeTimers()
    try {
      mockPrivyAuthenticated = false
      mockGetAccessToken.mockReset()
      mockGetAccessToken.mockResolvedValue(null)
      mockLogin.mockReset()
      mockLogin.mockImplementation(() => new Promise<never>(() => undefined))

      let bootstrapCalls = 0
      vi.mocked(apiFetch).mockImplementation(async (input: string) => {
        if (input.startsWith('/api/waitlist/bootstrap')) {
          bootstrapCalls += 1
          return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
        }
        if (input.startsWith('/api/auth/logout')) {
          return jsonResponse({ success: true }) as any
        }
        throw new Error(`Unhandled apiFetch call: ${input}`)
      })

      render(
        <MemoryRouter>
          <WaitlistFlow />
        </MemoryRouter>,
      )

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /continue/i }))
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_100)
      })

      expect(screen.getByText(/sign-in timed out/i)).toBeTruthy()
      expect(screen.getByRole('button', { name: /^continue$/i })).toBeTruthy()
      expect(bootstrapCalls).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

})
