import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { VaultCard } from './VaultCard'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
}))

vi.mock('wagmi', () => ({
  useReadContract: vi.fn(() => ({ data: 'AKITA' })),
}))

vi.mock('@/hooks/useVault', () => ({
  useVault: vi.fn(() => ({
    asset: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Akita Vault',
    totalAssets: 5_000_000n * 10n ** 18n,
    userShares: 0n,
  })),
}))

vi.mock('@/lib/zora/hooks', () => ({
  useZoraCoin: vi.fn(() => ({
    data: {
      tokenPrice: { priceInUsdc: '0.125' },
      marketCap: '625000',
      totalSupply: '5000000',
    },
  })),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: unknown[] }) => {
    if (queryKey[0] === 'auction-status') {
      return {
        data: {
          isActive: true,
          isGraduated: false,
          currencyRaised: '125000000',
          currencyDecimals: 6,
        },
      }
    }

    if (queryKey[0] === 'auction-activity') {
      return {
        data: {
          activity: [
            {
              transactionHash: '0xaaa',
              owner: '0x4444444444444444444444444444444444444444',
              amountDisplay: '2.5 AKITA',
            },
            {
              transactionHash: '0xbbb',
              owner: '0x5555555555555555555555555555555555555555',
              amountDisplay: '1.2 AKITA',
            },
          ],
        },
      }
    }

    return { data: undefined }
  }),
}))

describe('VaultCard', () => {
  it('renders USD TVL from creator coin price plus the token-denominated vault balance', () => {
    const html = renderToStaticMarkup(
      React.createElement(VaultCard, {
        vault: {
          vaultAddress: '0x1111111111111111111111111111111111111111',
          chainId: 8453,
          creatorCoinAddress: '0x2222222222222222222222222222222222222222',
          groupId: 'test',
          shareOFTAddress: '0x00f80e71e77b562fdf28522a7b80a7d53438d38b',
        },
      }),
    )

    expect(html).toContain('$')
    expect(html).toContain('625K')
    expect(html).toContain('5M AKITA')
  })
})
