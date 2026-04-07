// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { apiFetch } from '@/lib/apiBase'

import { WaitlistFlow } from './WaitlistFlow'

vi.mock('framer-motion', () => ({
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

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: mockPrivyAuthenticated,
    getAccessToken: mockGetAccessToken,
    logout: mockPrivyLogout,
    linkEmail: mockLinkEmail,
  }),
  useLogin: () => ({ login: mockLogin }),
  useCrossAppAccounts: () => ({
    loginWithCrossAppAccount: async () => undefined,
    linkCrossAppAccount: async () => undefined,
  }),
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ chainId: 8453 }),
  useSwitchChain: () => ({ switchChainAsync: async () => undefined }),
  useWalletClient: () => ({ data: null }),
}))

vi.mock('@/lib/apiBase', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('@/lib/host', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/host')>()
  return {
    ...actual,
    getAppBaseUrl: () => 'https://v1.4626.fun',
    getMarketingBaseUrl: () => 'https://4626.fun',
    getWaitlistReferralBaseUrl: () => 'https://4626.fun',
  }
})

vi.mock('@/lib/privy/client', () => ({
  ZORA_PRIVY_APP_ID: 'test-zora-app-id',
  usePrivyClientStatus: () => 'ready',
}))

vi.mock('@/lib/privy/embeddedWallet', () => ({
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

const WAITLIST_BOOTSTRAP_PAYLOAD = {
  success: true,
  data: {
    requiresPrivyAuth: false,
    privyUserId: 'did:privy:test-user',
    email: 'waitlisted@example.com',
    emailVerified: true,
    appAccessStatus: 'pending',
    linkedMethods: { email: ['waitlisted@example.com'] },
    accountSignals: {
      linked: true,
      canonicalCswAddress: null,
      creatorCoin: null,
      zoraHandle: null,
      lastResolvedAt: null,
    },
    score: {
      points: 1234,
      tier: 1,
    },
  },
}

describe('WaitlistFlow simplified completion UI', () => {
  beforeEach(() => {
    mockPrivyAuthenticated = true
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
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })
  })

  it('shows streamlined completion actions for verified waitlisted users', async () => {
    render(
      <MemoryRouter>
        <WaitlistFlow />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/you're in!/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /go to accounts/i })).toBeTruthy()
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

  it('recovers after recovery-required bootstrap when user taps Continue', async () => {
    let bootstrapCalls = 0
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        bootstrapCalls += 1
        if (bootstrapCalls === 1) {
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
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/logout')) {
        return jsonResponse({ success: true }) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })

    render(
      <MemoryRouter>
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    const continueButton = await screen.findByRole('button', { name: /^continue$/i }, { timeout: 6_000 })
    fireEvent.click(continueButton)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(0)
      expect(bootstrapCalls).toBeGreaterThanOrEqual(2)
    }, { timeout: 5_000 })
    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 5_000 })).toBeTruthy()
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 7_000 })).toBeTruthy()
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 9_000 })).toBeTruthy()
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 10_000 })).toBeTruthy()
    expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
  })

  it('does not call auth/logout before opening email login', async () => {
    mockPrivyAuthenticated = false
    mockGetAccessToken.mockReset()
    mockGetAccessToken.mockResolvedValue('privy-token-after-login')

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
        <WaitlistFlow autoStartAuth={false} />
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 9_000 })).toBeTruthy()
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/you're in!/i, undefined, { timeout: 9_000 })).toBeTruthy()
    // first requiresPrivyAuth + one cooldown-respected retry to recover
    expect(bootstrapCalls).toBeGreaterThanOrEqual(2)
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
        <WaitlistFlow autoStartAuth={false} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(bootstrapCalls).toBeGreaterThanOrEqual(1)
    }, { timeout: 6_000 })

    // Allow async retries to settle, then verify calls stay bounded (no ongoing spam loop).
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    const settledBootstrapCalls = bootstrapCalls
    await new Promise((resolve) => setTimeout(resolve, 1_800))
    expect(bootstrapCalls).toBe(settledBootstrapCalls)

    // one initial bootstrap + at most one recovery bootstrap probe
    expect(bootstrapCalls).toBeLessThanOrEqual(2)
    expect(logoutCalls).toBeLessThanOrEqual(1)
  })

  it('fails fast on wallet-provider collision instead of entering finalizing retries', async () => {
    mockPrivyAuthenticated = false
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
        <WaitlistFlow autoStartAuth={false} />
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

  it('releases busy lock when login hangs and surfaces a retryable timeout', async () => {
    vi.useFakeTimers()
    try {
      mockPrivyAuthenticated = false
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
          <WaitlistFlow autoStartAuth={false} />
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
