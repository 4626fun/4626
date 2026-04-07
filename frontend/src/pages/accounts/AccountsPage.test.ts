import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import { AccountsPage, readOptionalZoraStatus, shouldRefreshAccountsOnForeground } from './AccountsPage'

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
  useCreateWallet: () => ({ createWallet: async () => ({ address: '0x4444444444444444444444444444444444444444' }) }),
}))

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: null }),
  usePublicClient: () => ({ readContract: async () => true }),
  useAccount: () => ({ chainId: 8453, address: '0x1111111111111111111111111111111111111111' }),
  useSwitchChain: () => ({ switchChainAsync: async () => {} }),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

describe('AccountsPage', () => {
  it('renders sections with mocked account API data', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(AccountsPage, {
          initialData: {
            me: {
              privyUserId: 'did:privy:test-user',
              email: 'user@example.com',
              emailVerified: true,
              linkedMethods: {
                email: ['user@example.com'],
                google: ['google-sub-1'],
                zora_cross_app: ['0x1111111111111111111111111111111111111111'],
              },
              accountSignals: {
                linked: true,
                canonicalCswAddress: '0x2222222222222222222222222222222222222222',
                creatorCoin: { address: '0x3333333333333333333333333333333333333333' },
                zoraHandle: 'akita',
                lastResolvedAt: '2026-03-04T00:00:00.000Z',
              },
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

    expect(html).toContain('Workspace')
    expect(html).toContain('Bring your Zora smart wallet into 4626')
    expect(html).toContain('Open leaderboard')
    expect(html).toContain('Linked identities')
    expect(html).toContain('Open Zora')
    expect(html).toContain('Refresh Zora signals')
    expect(html).toContain('Owner authority')
    expect(html).toContain('Current owners')
    expect(html).toContain('Connect owner')
    expect(html).toContain('Verify authority')
    expect(html).toContain('Approve on Base')
    expect(html).toContain('Owner approval required')
    expect(html).toContain('Connect owner wallet')
    expect(html).toContain('MetaMask, Coinbase Wallet, detected browser wallets like Rabby, and WalletConnect QR fallback')
    expect(html).toContain('Connected signer')
    expect(html).toContain('0x111111...111111')
    expect(html).toContain('Advanced')
    expect(html).toContain('Why this setup')
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
