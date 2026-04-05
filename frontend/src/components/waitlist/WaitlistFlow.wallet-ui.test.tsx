// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

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

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: true,
    getAccessToken: async () => null,
    logout: async () => undefined,
  }),
  useLogin: () => ({ login: async () => undefined }),
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

const WAITLIST_POSITION_PAYLOAD = {
  success: true,
  data: {
    email: 'waitlisted@example.com',
    signupId: 77,
    profileCompletedAt: '2026-01-01T00:00:00.000Z',
    referralCode: 'FRIEND42',
    borderTier: 1,
    points: {
      total: 1234,
      invite: 800,
      signup: 100,
      tasks: 90,
      csw: 0,
      social: 200,
      bonus: 44,
    },
    rank: {
      invite: 12,
      total: 34,
    },
    totalCount: 5000,
    totalAheadInvite: 11,
    percentileInvite: 1,
    referrals: {
      qualifiedCount: 2,
      pendingCount: 3,
      pendingCountCapped: 3,
      pendingCap: 10,
    },
  },
}

const WAITLIST_LEADERBOARD_PAYLOAD = {
  success: true,
  data: {
    page: 1,
    limit: 6,
    pointsType: 'total',
    totalCount: 99,
    totalPages: 17,
    hasMore: true,
    leaderboard: [
      {
        rank: 1,
        signupId: 99,
        display: '0x1111...9999',
        referralCode: null,
        pointsTotal: 10000,
        pointsInvite: 8000,
        pointsAgent: 500,
        borderTier: 3,
      },
      {
        rank: 34,
        signupId: 77,
        display: '0x7777...7777',
        referralCode: 'FRIEND42',
        pointsTotal: 1234,
        pointsInvite: 800,
        pointsAgent: 100,
        borderTier: 1,
      },
    ],
    me: {
      rank: 34,
      signupId: 77,
      display: '0x7777...7777',
      referralCode: 'FRIEND42',
      pointsTotal: 1234,
      pointsInvite: 800,
      pointsAgent: 100,
      borderTier: 1,
    },
  },
}

describe('WaitlistFlow wallet-step UI', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockImplementation(async (input: string) => {
      if (input.startsWith('/api/waitlist/bootstrap')) {
        return jsonResponse(WAITLIST_BOOTSTRAP_PAYLOAD) as any
      }
      if (input.startsWith('/api/waitlist/position')) {
        return jsonResponse(WAITLIST_POSITION_PAYLOAD) as any
      }
      if (input.startsWith('/api/waitlist/leaderboard')) {
        return jsonResponse(WAITLIST_LEADERBOARD_PAYLOAD) as any
      }
      if (input.startsWith('/api/auth/privy')) {
        return jsonResponse({ success: true }) as any
      }
      throw new Error(`Unhandled apiFetch call: ${input}`)
    })
  })

  it('shows accounts and leaderboard actions for verified waitlisted users', async () => {
    render(
      <MemoryRouter>
        <WaitlistFlow variant="page" />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/climb the waitlist/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /go to accounts/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /open full leaderboard/i })).toBeTruthy()
    expect(screen.getByText(/waitlist leaderboard/i)).toBeTruthy()
    expect(screen.getByText(/referral link/i)).toBeTruthy()
  })
})
