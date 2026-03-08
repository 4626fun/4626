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
  it('renders symbol-first vault identity, explicit asset totals, and live committed capital', () => {
    const html = renderToStaticMarkup(
      React.createElement(VaultCard, {
        vault: {
          vaultAddress: '0x6666666666666666666666666666666666666666',
          chainId: 8453,
          creatorCoinAddress: '0x7777777777777777777777777777777777777777',
          groupId: 'akita',
          ccaStrategyAddress: '0x1111111111111111111111111111111111111111',
          shareOFTAddress: '0x00f80e71e77b562fdf28522a7b80a7d53438d38b',
        },
      }),
    )

    expect(html).toContain('AKITA Vault')
    expect(html).toContain('Share token')
    expect(html).toContain('0x00f80e71e77b562fdf28522a7b80a7d53438d38b')
    expect(html).toContain('Assets in vault')
    expect(html).toContain('5M AKITA')
    expect(html).toContain('Committed')
    expect(html).toContain('$125')
    expect(html).toContain('Base')
    expect(html).not.toContain('Chain 8453')
    expect(html).not.toContain('Underlying:')
    expect(html).not.toContain('APY TBD')
    expect(html).toContain('Live activity')
    expect(html).toContain('0x4444')
    expect(html).toContain('2.5 AKITA')
    expect(html).toContain('0x5555')
    expect(html).toContain('1.2 AKITA')
  })
})
