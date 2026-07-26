// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SWAP_COMPLETION_AUTO_DISMISS_MS,
  SwapCompletionNotice,
} from './SwapCompletionNotice'

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
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders a compact top-right completed swap linked to BaseScan', () => {
    const txHash = `0x${'1'.repeat(64)}`
    render(
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

    const notice = screen.getByRole('status')
    expect(notice.className).toContain('right-4 top-4 md:top-16')
    expect(notice.className).not.toContain('bottom-4 left-4')
    expect(screen.getByText('Swapped')).toBeTruthy()
    expect(screen.getByText('1.00 USDC for 786,456.00 AKITA')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View swap transaction/i }).getAttribute('href')).toBe(
      `https://basescan.org/tx/${txHash}`,
    )
    expect(screen.getByRole('button', { name: 'Dismiss swap confirmation' })).toBeTruthy()
  })

  it('keeps the submitted state truthful while the user operation confirms', () => {
    render(
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

    expect(screen.getByText('Swap submitted')).toBeTruthy()
    expect(screen.getByText('0.004321 USDC for 42.125 AKITA · Confirming on Base…')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('auto-dismisses after a few seconds once the fade completes', async () => {
    const onDismiss = vi.fn()
    render(
      <SwapCompletionNotice
        completion={{
          txHash: `0x${'3'.repeat(64)}`,
          amountInUnits: '2',
          estimatedOut: '10',
          completedAt: 42,
        }}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('status')).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SWAP_COMPLETION_AUTO_DISMISS_MS)
    })
    expect(onDismiss).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
