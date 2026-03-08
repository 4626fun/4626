import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { Vault } from './Vault'

const { RESOLVED } = vi.hoisted(() => ({
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
      case 'totalSupply':
        return { data: 5_000_000n * 10n ** 18n }
      case 'getAuctionStatus':
        return { data: [RESOLVED.info.vault, false, false, 0n, 0n] }
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
  Button: ({ children, ...props }: any) => React.createElement('button', props, children),
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
  useZoraCoin: () => ({ data: null }),
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
  it('removes the account chips, keeps hero links minimal, and prefers share OFT media', () => {
    const html = renderToStaticMarkup(React.createElement(Vault))

    expect(html).not.toContain('Connected: Not connected')
    expect(html).not.toContain('Acting as: Unavailable')
    expect(html).not.toContain('AMOE FREE ENTRY')
    expect(html).toContain('View wrapper')
    expect(html).toContain('Status checks')
    expect(html).toContain('Auction panel')
    expect(html).toContain('https://example.com/share-oft.png')
  })
})
