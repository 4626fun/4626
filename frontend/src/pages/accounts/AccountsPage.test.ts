import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { AccountsPage } from './AccountsPage'

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    authenticated: true,
    ready: true,
    getAccessToken: async () => 'test-token',
  }),
  useLogin: () => ({ login: async () => {} }),
  useCrossAppAccounts: () => ({
    loginWithCrossAppAccount: async () => {},
    linkCrossAppAccount: async () => {},
  }),
}))

vi.mock('wagmi', () => ({
  useWalletClient: () => ({ data: null }),
  useAccount: () => ({ chainId: 8453 }),
  useSwitchChain: () => ({ switchChainAsync: async () => {} }),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

describe('AccountsPage', () => {
  it('renders sections with mocked account API data', () => {
    const html = renderToStaticMarkup(
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
            zora: {
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
    )

    expect(html).toContain('Identity management')
    expect(html).toContain('Notifications')
    expect(html).toContain('Linked identities')
    expect(html).toContain('Telegram')
    expect(html).toContain('Zora')
    expect(html).toContain('Advanced')
    expect(html).toContain('Points:')
  })
})
