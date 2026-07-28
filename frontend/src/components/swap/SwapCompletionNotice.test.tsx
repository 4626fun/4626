// @vitest-environment happy-dom

import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SwapCompletion } from '@/hooks/useSwapExecution'

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

function makeCompletion(overrides: Partial<SwapCompletion> = {}): SwapCompletion {
  return {
    txHash: `0x${'1'.repeat(64)}`,
    amountInUnits: '1',
    estimatedOut: '10',
    completedAt: 1,
    chainId: 8453,
    tokenIn,
    tokenOut,
    ...overrides,
  }
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
        completion={makeCompletion({
          txHash,
          amountInUnits: '1',
          estimatedOut: '786456',
          completedAt: 1,
        })}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="confirmed"
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
        completion={makeCompletion({
          txHash: null,
          userOpHash: `0x${'2'.repeat(64)}`,
          amountInUnits: '0.004321',
          estimatedOut: '42.125',
          completedAt: 1,
        })}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="pending"
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('Swap submitted')).toBeTruthy()
    expect(screen.getByText('0.004321 USDC for 42.125 AKITA · Confirming on Base…')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dismiss swap confirmation' })).toBeNull()
  })

  it('starts auto-dismiss only after a pending user operation confirms', async () => {
    const onDismiss = vi.fn()
    const userOpHash = `0x${'2'.repeat(64)}`
    const txHash = `0x${'3'.repeat(64)}`
    const completion = makeCompletion({
      txHash: null,
      userOpHash,
      amountInUnits: '0.004321',
      estimatedOut: '42.125',
      completedAt: 1,
    })
    const { rerender } = render(
      <SwapCompletionNotice
        completion={completion}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="pending"
        onDismiss={onDismiss}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SWAP_COMPLETION_AUTO_DISMISS_MS + 500)
    })
    expect(screen.getByText('Swap submitted')).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()

    rerender(
      <SwapCompletionNotice
        completion={{ ...completion, txHash }}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="confirmed"
        onDismiss={onDismiss}
      />,
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SWAP_COMPLETION_AUTO_DISMISS_MS)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('auto-dismisses after a few seconds once the fade completes', async () => {
    const onDismiss = vi.fn()
    render(
      <SwapCompletionNotice
        completion={makeCompletion({
          txHash: `0x${'3'.repeat(64)}`,
          amountInUnits: '2',
          estimatedOut: '10',
          completedAt: 42,
        })}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="confirmed"
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

  it('keeps a reverted swap visible as failed with a BaseScan link', async () => {
    const onDismiss = vi.fn()
    const txHash = `0x${'4'.repeat(64)}`
    render(
      <SwapCompletionNotice
        completion={makeCompletion({
          txHash,
          amountInUnits: '2',
          estimatedOut: '10',
          completedAt: 43,
        })}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="failed"
        onDismiss={onDismiss}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SWAP_COMPLETION_AUTO_DISMISS_MS + 500)
    })

    expect(screen.getByText('Swap failed')).toBeTruthy()
    expect(screen.getByText('2.00 USDC for 10.00 AKITA · Failed on Base')).toBeTruthy()
    expect(screen.getByRole('link', { name: /View swap transaction/i }).getAttribute('href')).toBe(
      `https://basescan.org/tx/${txHash}`,
    )
    expect(screen.getByRole('button', { name: 'Dismiss swap confirmation' })).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('keeps delayed confirmation mounted and manually dismissible', async () => {
    const onDismiss = vi.fn()
    render(
      <SwapCompletionNotice
        completion={makeCompletion({
          txHash: null,
          userOpHash: `0x${'5'.repeat(64)}`,
          amountInUnits: '2',
          estimatedOut: '10',
          completedAt: 44,
          confirmationTimedOut: true,
        })}
        tokenIn={tokenIn}
        tokenOut={tokenOut}
        settlement="delayed"
        onDismiss={onDismiss}
      />,
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SWAP_COMPLETION_AUTO_DISMISS_MS + 500)
    })

    expect(screen.getByText('Confirmation delayed')).toBeTruthy()
    expect(
      screen.getByText(
        '2.00 USDC for 10.00 AKITA · Still confirming — dismiss only if you want to unlock another swap',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dismiss swap confirmation' })).toBeTruthy()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('keeps submitted token identities when form props change', () => {
    render(
      <SwapCompletionNotice
        completion={makeCompletion({
          amountInUnits: '2',
          estimatedOut: '10',
          tokenIn,
          tokenOut,
        })}
        tokenIn={tokenOut}
        tokenOut={tokenIn}
        settlement="confirmed"
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText('2.00 USDC for 10.00 AKITA')).toBeTruthy()
    expect(screen.queryByText('2.00 AKITA for 10.00 USDC')).toBeNull()
  })
})
