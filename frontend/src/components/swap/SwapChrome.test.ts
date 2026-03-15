import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { SwapCard } from './SwapCard'
import { SwapPageLayout } from './SwapPageLayout'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, whileTap, ...props }: any) => {
      void whileTap
      return React.createElement('button', props, children)
    },
  },
}))

vi.mock('@/components/swap/SwapDetails', () => ({
  SwapDetails: () => React.createElement('div', null, 'Swap details'),
}))

vi.mock('@/components/swap/TokenInput', () => ({
  TokenInput: ({ label }: any) => React.createElement('div', null, label),
}))

vi.mock('@/components/trade/ChainSelector', () => ({
  ChainSelector: () => React.createElement('div', null, 'Base'),
}))

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, loading, ...props }: any) => {
    void loading
    return React.createElement('button', props, children)
  },
}))

vi.mock('@/components/ui/Alert', () => ({
  Alert: ({ children }: any) => React.createElement('div', null, children),
}))

vi.mock('@/components/ui/WalletProviderIcon', () => ({
  WalletProviderIcon: () => React.createElement('div', null, 'wallet-icon'),
}))

describe('Swap chrome', () => {
  it('removes the wallet mode chip from the swap card header', () => {
    const html = renderToStaticMarkup(
      React.createElement(SwapCard, {
        tokenInDisplay: { symbol: 'USDC', name: 'USD Coin', logoUrl: null, logoUrls: [] },
        tokenOutDisplay: { symbol: 'AKITA', name: 'Akita', logoUrl: null, logoUrls: [] },
        tokenInIdentityLoading: false,
        tokenOutIdentityLoading: false,
        amountInUnits: '10',
        estimatedOut: '100',
        estimatedOutUsd: '$100',
        tokenInSymbol: 'USDC',
        tokenOutSymbol: 'AKITA',
        isConnected: true,
        isReady: true,
        busy: null,
        status: null,
        error: null,
        quoteUpdatedAt: null,
        approvalRequired: false,
        tokenInAddress: '0x1111111111111111111111111111111111111111',
        tokenOutAddress: '0x2222222222222222222222222222222222222222',
        routeSummary: 'Best price',
        gasEstimateLabel: '$1.25',
        priceImpactLabel: '0.1%',
        lpFeeUsd: '$0.10',
        protocolFeeUsd: '$0.05',
        selectedChainId: 8453,
        walletChainId: 8453,
        onSelectChain: vi.fn(),
        slippagePct: '0.5',
        onOpenTokenSelector: vi.fn(),
        onAmountChange: vi.fn(),
        onQuickPercent: vi.fn(),
        onSwitchTokens: vi.fn(),
        onReviewTrade: vi.fn(),
        onSetSlippagePct: vi.fn(),
        onConfirmUnverified: vi.fn(),
        executionMode: 'eoa',
        fallbackActive: false,
        needsUnverifiedConfirmation: false,
        unverifiedTokenLabel: null,
        onResetUnverified: vi.fn(),
      }),
    )

    expect(html).toContain('Powered by')
    expect(html).not.toContain('User Wallet')
    expect(html).not.toContain('Coinbase Smart Wallet')
  })

  it('does not render the extra kicker above the swap title', () => {
    const html = renderToStaticMarkup(
      React.createElement(SwapPageLayout, {
        swapPanel: React.createElement('div', null, 'swap panel'),
        vaultPanel: React.createElement('div', null, 'vault panel'),
        title: 'Swap',
        subtitle: '1-Click Swaps on Base',
      }),
    )

    expect(html).toContain('Swap')
    expect(html).not.toContain('1-Click Swaps on Base')
  })
})
