import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AccountsPage, readOptionalZoraStatus, shouldRefreshAccountsOnForeground } from './AccountsPage'
import type { AccountSignals } from '@/features/accountSetup/types'

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: true,
    ready: true,
    getAccessToken: async () => 'test-token',
    user: { linkedAccounts: [] },
  }),
  useLogin: () => ({ login: async () => {} }),
  useConnectWallet: () => ({ connectWallet: () => {} }),
  useCrossAppAccounts: () => ({
    loginWithCrossAppAccount: async () => {},
    linkCrossAppAccount: async () => {},
  }),
  useActiveWallet: () => ({ wallet: undefined }),
  useWallets: () => ({ wallets: [] }),
  useBaseAccountSdk: () => ({ baseAccountSdk: null }),
  toViemAccount: () => null,
  useDelegatedActions: () => ({
    delegateWallet: async () => {},
    revokeWallets: async () => {},
  }),
  useCreateWallet: () => ({ createWallet: async () => ({ address: '0x4444444444444444444444444444444444444444' }) }),
}))

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: null }),
  usePublicClient: () => ({ readContract: async () => true }),
  useAccount: () => ({ chainId: 8453, address: '0x1111111111111111111111111111111111111111' }),
  useSwitchChain: () => ({ switchChainAsync: async () => {} }),
  useConnections: () => [],
  useSignMessage: () => ({ signMessageAsync: async () => '0xsignature' }),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

// New identity surface components render react-query / wagmi hooks that
// require provider context which this SSR-style test doesn't set up.
// Mock them as no-ops so we keep validating the "Advanced" content
// (which is the original page body, now behind a disclosure) without
// having to thread a full provider tree through the test.
vi.mock('@/components/account/YourIdentityHero', () => ({
  YourIdentityHero: () => null,
  SignersSection: () => null,
  AdvancedDisclosure: (props: any) =>
    React.createElement('div', { 'data-advanced-disclosure': true }, props.children),
}))

vi.mock('@/features/executionScope/ExecutionScopeCard', () => ({
  ExecutionScopeCard: () => null,
}))

vi.mock('@/features/executionScope/AutoProvisionMount', () => ({
  AutoProvisionMount: () => null,
}))

function accountSignals(overrides: Partial<AccountSignals> = {}): AccountSignals {
  return {
    linked: true,
    canonicalCswAddress: '0x2222222222222222222222222222222222222222',
    baseSubAccount: {
      address: null,
      registered: false,
      isDistinctFromCsw: false,
    },
    executionTrack: 'none-yet' as const,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: null,
    creatorCoin: { address: '0x3333333333333333333333333333333333333333' },
    zoraHandle: 'akita',
    lastResolvedAt: '2026-03-04T00:00:00.000Z',
    ...overrides,
  }
}

function renderAccountsPage(element: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client: queryClient }, element),
  )
}

describe('AccountsPage', () => {
  it('renders sections with mocked account API data', () => {
    const html = renderAccountsPage(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(AccountsPage, {
          initialData: {
            me: {
              privyUserId: 'did:privy:test-user',
              email: 'user@example.com',
              emailVerified: true,
              appAccessStatus: 'approved',
              baseSubAccount: null,
              linkedMethods: {
                email: ['user@example.com'],
                google: ['google-sub-1'],
                zora_cross_app: ['0x1111111111111111111111111111111111111111'],
              },
              accountSignals: accountSignals(),
              score: {
                points: 130,
                tier: 2,
              },
            },
            zoraStatus: {
              zoraLinked: true,
              zoraCrossAppAccounts: [
                { address: '0x1111111111111111111111111111111111111111', providerAppId: 'clpgf04wn04hnkw0fv1m11mnb' },
              ],
            },
          },
        }),
      ),
    )

    expect(html).toContain('Your identity')
    expect(html).toContain('Workspace')
    expect(html).toContain('Open leaderboard')
    expect(html).toContain('Account settings')
    expect(html).toContain('Connect with Zora')
    expect(html).toContain('Refresh Zora signals')
    expect(html).toContain('Owner authority')
    expect(html).toContain('Current owners')
    expect(html).toContain('Connect owner')
    expect(html).toContain('Verify authority')
    expect(html).toContain('Approve on Base')
    expect(html).toContain('Owner approval required')
    expect(html).toContain('Connect owner wallet')
    expect(html).toContain('MetaMask, Coinbase Wallet, and detected browser wallets like Rabby')
    expect(html).toContain('Connected signer')
    expect(html).toContain('0x111111...111111')
  })

  it('surfaces the Telegram owner-install resume banner when requested from query params', () => {
    const html = renderAccountsPage(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/accounts?setup=owner-install&source=telegram'] },
        React.createElement(AccountsPage, {
          initialData: {
            me: {
              privyUserId: 'did:privy:test-user',
              email: 'user@example.com',
              emailVerified: true,
              appAccessStatus: 'approved',
              baseSubAccount: null,
              linkedMethods: {
                email: ['user@example.com'],
              },
              accountSignals: accountSignals(),
              score: {
                points: 130,
                tier: 2,
              },
            },
            zoraStatus: {
              zoraLinked: true,
              zoraCrossAppAccounts: [],
            },
          },
        }),
      ),
    )

    expect(html).toContain('Continue from Telegram')
    expect(html).toContain('Your Telegram account is linked. Finish wallet setup here.')
    expect(html).toContain('This step was resumed from another surface.')
  })

  it('treats Zora status as optional when the response is unavailable', () => {
    expect(
      readOptionalZoraStatus({
        responseOk: false,
        payload: null,
      }),
    ).toBeNull()
  })

  it('refreshes on foreground return only while wallet finalization still needs action', () => {
    expect(
      shouldRefreshAccountsOnForeground({
        privyAuthed: true,
        ownerDelegationFlags: { needsBaseAppSetup: true },
        advancedBusy: false,
      }),
    ).toBe(true)

    expect(
      shouldRefreshAccountsOnForeground({
        privyAuthed: true,
        ownerDelegationFlags: null,
        advancedBusy: false,
      }),
    ).toBe(false)

    expect(
      shouldRefreshAccountsOnForeground({
        privyAuthed: true,
        ownerDelegationFlags: { needsEmbeddedWallet: true },
        advancedBusy: true,
      }),
    ).toBe(false)
  })
})
