import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { Vault } from './Vault'

const { RESOLVED, ONCHAIN_AUCTION_STATUS, API_AUCTION_STATUS } = vi.hoisted(() => ({
  RESOLVED: {
    token: '0x1111111111111111111111111111111111111111',
    ccaStrategy: '0x2222222222222222222222222222222222222222',
    info: {
      wrapper: '0x3333333333333333333333333333333333333333',
      shareOFT: '0x4444444444444444444444444444444444444444',
      vault: '0x5555555555555555555555555555555555555555',
      symbol: 'AKITA',
    },
  },
  ONCHAIN_AUCTION_STATUS: [0n, false, true, 0n, 0n] as [bigint, boolean, boolean, bigint, bigint],
  API_AUCTION_STATUS: {
    isActive: false,
    isGraduated: true,
    currencyRaised: '0',
    currencyDecimals: 6,
    auctionTokenSymbol: 'USDC',
  },
}))

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({ children, ...props }: any) => React.createElement(tag, props, children),
    },
  ),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => React.createElement('a', { href: to, ...props }, children),
  useParams: () => ({ address: RESOLVED.info.vault }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x9999999999999999999999999999999999999999' }),
  usePublicClient: () => ({}),
  useReadContract: ({ functionName }: any) => {
    switch (functionName) {
      case 'decimals':
        return { data: 18 }
      case 'totalAssets':
        return { data: 5_000_000n * 10n ** 18n }
      case 'totalSupply':
        return { data: 5_000_000n * 10n ** 18n }
      case 'getAuctionStatus':
        return { data: [RESOLVED.info.vault, ONCHAIN_AUCTION_STATUS[1], ONCHAIN_AUCTION_STATUS[2], ONCHAIN_AUCTION_STATUS[3], ONCHAIN_AUCTION_STATUS[4]] }
      case 'allowance':
        return { data: 0n }
      case 'balanceOf':
        return { data: 0n }
      default:
        return { data: undefined }
    }
  },
  useWriteContract: () => ({ writeContract: vi.fn(), data: undefined }),
  useWaitForTransactionReceipt: () => ({ isLoading: false, isSuccess: false }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: any) => {
    if (queryKey?.[0] === 'vaultResolve') return { data: RESOLVED, isLoading: false, error: null }
    if (queryKey?.[0] === 'auction-status') return { data: API_AUCTION_STATUS, isLoading: false, error: null }
    return { data: undefined, isLoading: false, error: null }
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, loading, ...props }: any) => {
    void loading
    return React.createElement('button', props, children)
  },
}))

vi.mock('@/components/ui/Skeleton', () => ({
  Skeleton: (props: any) => React.createElement('div', props),
}))

vi.mock('@/components/ui/AccountModeIndicator', () => ({
  AccountModeIndicator: () => null,
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
  META: { vault: (symbol: string) => ({ title: `${symbol} Vault`, description: `${symbol} vault` }) },
}))

vi.mock('@/components/cca/CcaAuctionPanel', () => ({
  CcaAuctionPanel: () => React.createElement('div', null, 'Auction panel content'),
}))

vi.mock('@/components/lottery/AmoeEntryCard', () => ({
  AmoeEntryCard: () => React.createElement('div', null, 'AMOE FREE ENTRY'),
}))

vi.mock('@/hooks/useTokenMetadata', () => ({
  useTokenMetadata: (address?: string) => ({
    imageUrl:
      address?.toLowerCase() === RESOLVED.info.shareOFT.toLowerCase()
        ? 'https://example.com/share-oft.png'
        : 'https://example.com/underlying-token.png',
  }),
}))

vi.mock('@/lib/zora/hooks', () => ({
  useZoraCoin: () => ({
    data: {
      tokenPrice: { priceInUsdc: '0.125' },
      marketCap: '625000',
      totalSupply: '5000000',
    },
  }),
}))

vi.mock('@/lib/onchain/vaultResolve', () => ({
  resolveVaultByAnyAddress: vi.fn(),
}))

vi.mock('@/components/brand/OrbBorder', () => ({
  OrbBorder: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('@/components/brand/TokenOrb', () => ({
  TokenOrb: ({ image, symbol }: any) =>
    React.createElement('img', { src: image, alt: symbol ?? 'Token image' }),
}))

vi.mock('@/lib/tokenSymbols', () => ({
  SHARE_SYMBOL_PREFIX: '■',
  toShareSymbol: (symbol: string) => `s${symbol}`,
}))

vi.mock('@/wallet/accountContext', () => ({
  useAccountContext: () => ({
    signerAddress: null,
    signerType: 'EOA',
    activeAccount: null,
    activeAccountType: 'UNKNOWN',
  }),
}))

vi.mock('../components/ClaimPrizeToSolana', () => ({
  ClaimPrizeToSolana: () => null,
}))

vi.mock('../config/contracts', () => ({
  AKITA: {
    token: RESOLVED.token,
    wrapper: RESOLVED.info.wrapper,
    shareOFT: RESOLVED.info.shareOFT,
    vault: RESOLVED.info.vault,
    ccaStrategy: RESOLVED.ccaStrategy,
  },
  CONTRACTS: { solanaBridgeAdapter: '0x6666666666666666666666666666666666666666' },
}))

describe('Vault', () => {
  it('shows USD TVL with token-denominated context on the vault stats panel', () => {
    ONCHAIN_AUCTION_STATUS[1] = false
    ONCHAIN_AUCTION_STATUS[2] = true
    API_AUCTION_STATUS.isActive = false
    API_AUCTION_STATUS.isGraduated = true
    API_AUCTION_STATUS.currencyRaised = '0'
    const html = renderToStaticMarkup(React.createElement(Vault))

    expect(html).not.toContain('Connected: Not connected')
    expect(html).not.toContain('Acting as: Unavailable')
    expect(html).not.toContain('AMOE FREE ENTRY')
    expect(html).toContain('View wrapper')
    expect(html).toContain('Status checks')
    expect(html).toContain('Auction panel')
    expect(html).toContain('https://example.com/share-oft.png')
    expect(html).toContain('TVL')
    expect(html).toContain('$625K')
    expect(html).toContain('5,000,000 AKITA in vault')
    expect(html).toContain('Total Supply')
  })

  it('shows committed capital in the stats grid while the auction is active', () => {
    ONCHAIN_AUCTION_STATUS[1] = true
    ONCHAIN_AUCTION_STATUS[2] = false
    API_AUCTION_STATUS.isActive = true
    API_AUCTION_STATUS.isGraduated = false
    API_AUCTION_STATUS.currencyRaised = '125000000'

    const html = renderToStaticMarkup(React.createElement(Vault))

    expect(html).toContain('Committed')
    expect(html).toContain('$125')
  })
})
