import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import { SwapCompletionNotice } from './SwapCompletionNotice'

const tokenIn = {
  symbol: 'USDC',
  name: 'USD Coin',
  logoUrl: null,
  logoUrls: [],
}

const tokenOut = {
  symbol: 'AKITA',
  name: 'Akita',
  logoUrl: null,
  logoUrls: [],
}

describe('SwapCompletionNotice', () => {
  it('renders a compact top-right completed swap linked to BaseScan', () => {
    const txHash = `0x${'1'.repeat(64)}`
    const html = renderToStaticMarkup(
      <SwapCompletionNotice
        completion={{
          txHash,
          amountInUnits: '1',
          estimatedOut: '786456',
          completedAt: 1,
        }}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        onDismiss={vi.fn()}
      />,
    )

    expect(html).toContain('right-4 top-4 md:top-16')
    expect(html).not.toContain('bottom-4 left-4')
    expect(html).toContain('>Swapped<')
    expect(html).toContain('1.00 USDC for 786,456.00 AKITA')
    expect(html).toContain(`href="https://basescan.org/tx/${txHash}"`)
    expect(html).toContain('aria-label="View swap transaction')
    expect(html).toContain('aria-label="Dismiss swap confirmation"')
    expect(html).toContain('>US<')
    expect(html).toContain('>AK<')
  })

  it('keeps the submitted state truthful while the user operation confirms', () => {
    const html = renderToStaticMarkup(
      <SwapCompletionNotice
        completion={{
          txHash: null,
          userOpHash: `0x${'2'.repeat(64)}`,
          amountInUnits: '0.004321',
          estimatedOut: '42.125',
          completedAt: 1,
        }}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        onDismiss={vi.fn()}
      />,
    )

    expect(html).toContain('Swap submitted')
    expect(html).toContain('0.004321 USDC for 42.125 AKITA · Confirming on Base…')
    expect(html).not.toContain('<a ')
  })
})
