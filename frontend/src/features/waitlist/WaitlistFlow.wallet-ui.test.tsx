// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'

import { apiFetch } from '@/lib/api/apiBase'
import { AppLoadingProvider } from '@/components/layout/AppLoadingOverlay'

import { WaitlistFlow } from './WaitlistFlow'
import { WaitlistSetupWorkspace } from './WaitlistSetupWorkspace'
import { clearWaitlistRecoveryGate, writeWaitlistRecoveryGate } from './waitlistRecoveryGate'
import { clearWaitlistAuthPending } from './waitlistAuthPending'

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
  useReducedMotion: () => false,
  motion: new Proxy(
    ((component: any) => component) as any,
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
  m: new Proxy(
    ((component: any) => component) as any,
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

let mockPrivyAuthenticated = false
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

vi.mock('@/lib/auth/canonicalization', () => ({
  runCanonicalizationPipeline: vi.fn(async () => ({
    onboardingBootstrapped: false,
    flags: { needsEmbeddedWallet: false },
    onboarding: null,
  })),
}))

vi.mock('./useEmbeddedOwnerOnCsw', () => ({
  useEmbeddedOwnerOnCsw: () => ({
    status: 'not-owner',
    isOwner: false,
    needsInstall: true,
    refresh: vi.fn(async () => undefined),
  }),
}))

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: mockPrivyAuthenticated,
    getAccessToken: mockGetAccessToken,
    logout: mockPrivyLogout,
    linkEmail: mockLinkEmail,
    linkEmailAccount: mockLinkEmail,
  }),
  useLogin: () => ({ login: mockLogin }),
  useConnectWallet: () => ({ connectWallet: () => undefined }),
  useCrossAppAccounts: () => ({
    loginWithCrossAppAccount: async () => undefined,
    linkCrossAppAccount: async () => undefined,
  }),
  useActiveWallet: () => ({ wallet: mockPrivyHookState.wallet }),
  useWallets: () => ({ wallets: mockPrivyHookState.wallets }),
  useBaseAccountSdk: () => ({ baseAccountSdk: null }),
  toViemAccount: vi.fn(),
  useDelegatedActions: () => ({
    delegateWallet: async () => undefined,
    revokeWallets: async () => undefined,
  }),
}))

vi.mock('wagmi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('wagmi')>()
  return {
    ...actual,
    useAccount: () => ({ chainId: 8453, address: '0x1111111111111111111111111111111111111111' }),
    usePublicClient: () => mockWagmiPublicClient,
    useSwitchChain: () => mockWagmiSwitchChain,
    useWalletClient: () => mockWagmiWalletClientState,
    useConnections: () => [],
    useSignMessage: () => ({ signMessageAsync: async () => '0xsignature' }),
    WagmiProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/env/host', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env/host')>()
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

vi.mock('@/lib/base/baseBuilderCodes', () => ({
  DATA_SUFFIX: undefined,
  resolveDataSuffix: () => undefined,
  warnGlobalWagmiDataSuffixBehavior: () => undefined,
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

vi.mock('@/features/archB/ArchBEnrollmentCard', () => ({
  ArchBEnrollmentCard: () => null,
}))

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function render(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return rtlRender(
    <QueryClientProvider client={queryClient}>
      <AppLoadingProvider>{ui}</AppLoadingProvider>
    </QueryClientProvider>,
  )
}

async function continueWaitlist() {
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^continue$/i }))
  })
}

async function continueIntoWaitlistSetup() {
  const continueButton = screen.queryByRole('button', { name: /^continue$/i })
  if (continueButton) {
    await continueWaitlist()
  }
  expect(await screen.findByRole('heading', { name: /you're on the waitlist/i }, { timeout: 8_000 })).toBeTruthy()
  expect(await screen.findByRole('heading', { name: /activate your account/i })).toBeTruthy()
}

const WAITLIST_ACCOUNT = {
  privyUserId: 'did:privy:test-user',
  email: 'waitlisted@example.com',
  emailVerified: true,
  appAccessStatus: 'pending',
  baseSubAccount: null,
  linkedMethods: { email: ['waitlisted@example.com'] },
  accountSignals: {
    linked: false,
    canonicalCswAddress: null,
    baseSubAccount: {
      address: null,
      registered: false,
      isDistinctFromCsw: false,
    },
    executionTrack: 'none-yet',
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
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
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    mockPrivyAuthenticated = false
    collisionStateRef.current = {
      hasMultipleInjectedProviders: false,
      lockedEthereumProviderGlobal: false,
      persistedCollisionSignal: false,
      shouldDisableInjectedConnector: false,
    }
    mockPrivyLogout.mockReset()
    mockPrivyLogout.mockImplementation(async () => {
      mockPrivyAuthenticated = false
    })
    mockLinkEmail.mockReset()
    mockLinkEmail.mockResolvedValue(undefined)
    mockLogin.mockReset()
    mockLogin.mockImplementation(async () => {
      mockPrivyAuthenticated = true
    })
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockImplementation(async () => (mockPrivyAuthenticated ? 'privy-token-default' : null))
    clearWaitlistRecoveryGate()
    clearWaitlistAuthPending()
    sessionStorage.clear()

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
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
    mockPrivyAuthenticated = true
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await continueIntoWaitlistSetup()
    expect(screen.queryByRole('heading', { name: /^waitlist$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull()
    expect(screen.queryByText(/climb the waitlist/i)).toBeNull()
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
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 52, capacity: 100, spotsRemaining: 48 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /^waitlist$/i })).toBeTruthy()
    expect(
      screen.queryByText(/one secure email sign-in saves your spot\. then we guide you through setup in a few clear steps\./i),
    ).toBeNull()
  })

  it('calls sign out from the setup workspace footer', async () => {
    const onSignOut = vi.fn()

    render(
      <MemoryRouter>
        <WaitlistSetupWorkspace
          initialAccount={WAITLIST_ACCOUNT as any}
          canEnterApp={false}
          completionBusy={false}
          onEnterApp={vi.fn()}
          onSignOut={onSignOut}
        />
      </MemoryRouter>,
    )

    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: /^sign out$/i }))
    })

    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('renders a setup-first workspace for verified users instead of a CTA-only completion state', async () => {
    mockPrivyAuthenticated = true
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await continueIntoWaitlistSetup()
    expect(screen.queryByRole('heading', { name: /^waitlist$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^continue$/i })).toBeNull()
  })

  it('shows a single setup title after entering the waitlist setup workspace', async () => {
    mockPrivyAuthenticated = true
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await continueIntoWaitlistSetup()
    expect(screen.getAllByRole('heading', { name: /activate your account/i })).toHaveLength(1)
  })

  it('keeps waitlist workspace focused and hides advanced settings action', async () => {
    render(
      <MemoryRouter>
        <WaitlistSetupWorkspace
          initialAccount={WAITLIST_ACCOUNT as any}
          canEnterApp={false}
          completionBusy={false}
          onEnterApp={vi.fn()}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /activate your account/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /account settings/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /advanced account settings/i })).toBeNull()
  })

  it('shows enter app when approved even if optional setup is incomplete', async () => {
    render(
      <MemoryRouter>
        <WaitlistSetupWorkspace
          initialAccount={WAITLIST_ACCOUNT as any}
          canEnterApp
          completionBusy={false}
          onEnterApp={vi.fn()}
          onSignOut={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /activate your account/i })).toBeTruthy()
    expect(await screen.findByRole('button', { name: /enter app/i })).toBeTruthy()
  })

  it('shows existing-account recovery when authed bootstrap returns recovery-required', async () => {
    mockPrivyAuthenticated = true
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
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('button', { name: /use existing account/i }, { timeout: 5_000 }),
    ).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('uses legacy recovery handoff only before Privy email auth completes', async () => {
    mockPrivyAuthenticated = false
    let tokenReads = 0
    mockGetAccessToken.mockImplementation(async () => {
      tokenReads += 1
      if (tokenReads <= 2) return 'stale-privy-token'
      return null
    })
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
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/handoff/create')) {
        return jsonResponse({ success: true, data: { code: 'handoff-code', expiresAt: '2099-01-01T00:00:00.000Z' } }) as any
      }
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
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

    await continueWaitlist()

    fireEvent.click(await screen.findByRole('button', { name: /use existing account/i }, { timeout: 5_000 }))

    await waitFor(() => {
      expect(mockPrivyLogout).toHaveBeenCalledTimes(1)
      expect(mockLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          loginMethods: ['email'],
          disableSignup: true,
        }),
      )
    }, { timeout: 5_000 })
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('does not block normal Privy login when a stale recovery gate is persisted', async () => {
    writeWaitlistRecoveryGate(true)
    mockPrivyAuthenticated = false

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: /^continue$/i }, { timeout: 5_000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /use existing account/i })).toBeNull()

    await continueWaitlist()

    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        loginMethods: ['email'],
      }),
    )
    expect(mockLogin).not.toHaveBeenCalledWith(
      expect.objectContaining({
        disableSignup: true,
      }),
    )
    expect(mockPrivyLogout).not.toHaveBeenCalled()
  })

  it('does not reload waitlist when recovery auth bridge is rejected', async () => {
    mockPrivyAuthenticated = false
    let bootstrapCalls = 0
    const locationAssign = vi.fn()
    const originalLocation = window.location

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        origin: 'https://4626.fun',
        pathname: '/waitlist',
        href: 'https://4626.fun/waitlist',
        assign: locationAssign,
      },
    })

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
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/privy')) {
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
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter initialEntries={['/waitlist']}>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await continueWaitlist()

    expect(await screen.findByRole('button', { name: /^continue$/i }, { timeout: 6_000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /use existing account/i })).toBeNull()
    expect(
      await screen.findByText(/this email is already on 4626/i, undefined, { timeout: 5_000 }),
    ).toBeTruthy()
    expect(locationAssign).not.toHaveBeenCalled()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(mockPrivyLogout).not.toHaveBeenCalled()

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
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await continueWaitlist()

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 7_000 })
    await waitFor(() => {
      expect(screen.getByText(/activate your account/i)).toBeTruthy()
    }, { timeout: 7_000 })
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

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 9_000 })
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

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 10_000 })
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('continues bootstrap when Privy authed before login() resolves', async () => {
    mockPrivyAuthenticated = false
    let bootstrapCalls = 0

    mockLogin.mockReset()
    mockLogin.mockImplementation(
      () =>
        new Promise<undefined>(() => {
          // Simulates email verification completing outside the login() promise.
        }),
    )

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    const view = render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    })

    mockPrivyAuthenticated = true
    await act(async () => {
      view.rerender(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            })
          }
        >
          <AppLoadingProvider>
            <MemoryRouter>
              <WaitlistFlow />
            </MemoryRouter>
          </AppLoadingProvider>
        </QueryClientProvider>,
      )
    })

    expect(await screen.findByRole('heading', { name: /you're on the waitlist/i }, { timeout: 8_000 })).toBeTruthy()
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

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 9_000 })
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
      await screen.findByText(/sign-in session expired/i, undefined, { timeout: 9_000 }),
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

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 9_000 })
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

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 9_000 })
    // first requiresPrivyAuth + optional cooldown-respected retry to recover
    expect(bootstrapCalls).toBeLessThanOrEqual(3)

    // Drain background retry timers so the next test does not inherit bootstrap calls.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 4_000))
    })
    const settledBootstrapCalls = bootstrapCalls
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })
    expect(bootstrapCalls).toBe(settledBootstrapCalls)
  })

  it('opens a recovery circuit breaker when bootstrap keeps returning recovery-required', async () => {
    mockPrivyAuthenticated = false
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

    await continueWaitlist()

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 6_000 })

    expect(await screen.findByRole('button', { name: /^continue$/i }, { timeout: 5_000 })).toBeTruthy()
    expect(
      await screen.findByText(/this email is already on 4626/i, undefined, { timeout: 5_000 }),
    ).toBeTruthy()

    // Allow async follow-ups to settle, then verify calls stay bounded (no ongoing spam loop).
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    const settledBootstrapCalls = bootstrapCalls
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    expect(bootstrapCalls).toBeLessThanOrEqual(settledBootstrapCalls + 1)

    // one explicit bootstrap after Continue, no auto-retry loop
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

  it('auto-bootstraps after email verify when auth-pending flag is missing', async () => {
    mockPrivyAuthenticated = false
    let bootstrapCalls = 0

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    const view = render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^continue$/i }))
    })

    clearWaitlistAuthPending()
    mockPrivyAuthenticated = true
    await act(async () => {
      view.rerender(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            })
          }
        >
          <AppLoadingProvider>
            <MemoryRouter>
              <WaitlistFlow />
            </MemoryRouter>
          </AppLoadingProvider>
        </QueryClientProvider>,
      )
    })

    expect(await screen.findByRole('heading', { name: /you're on the waitlist/i }, { timeout: 8_000 })).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('ignores a stale recovery gate after Privy email auth and bootstraps normally', async () => {
    writeWaitlistRecoveryGate(true)
    mockPrivyAuthenticated = false
    let bootstrapCalls = 0

    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/waitlist/stats')) {
        return jsonResponse({
          success: true,
          data: { signedUpCount: 0, capacity: 0, spotsRemaining: 0 },
        }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    const view = render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    clearWaitlistAuthPending()
    mockPrivyAuthenticated = true
    await act(async () => {
      view.rerender(
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            })
          }
        >
          <AppLoadingProvider>
            <MemoryRouter>
              <WaitlistFlow />
            </MemoryRouter>
          </AppLoadingProvider>
        </QueryClientProvider>,
      )
    })

    expect(await screen.findByRole('heading', { name: /you're on the waitlist/i }, { timeout: 8_000 })).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: /use existing account/i })).toBeNull()
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
