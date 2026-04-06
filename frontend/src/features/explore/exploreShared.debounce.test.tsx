// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'

import { useDebouncedValue } from '@/features/explore/exploreShared'

function DebounceHarness({ value, delayMs }: { value: string; delayMs: number }) {
  const debounced = useDebouncedValue(value, delayMs)
  return <div data-testid="debounced">{debounced}</div>
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('delays updates until the debounce window elapses', () => {
    const view = render(<DebounceHarness value="alpha" delayMs={250} />)
    expect(screen.getByTestId('debounced').textContent).toBe('alpha')

    view.rerender(<DebounceHarness value="bravo" delayMs={250} />)
    expect(screen.getByTestId('debounced').textContent).toBe('alpha')

    act(() => {
      vi.advanceTimersByTime(249)
    })
    expect(screen.getByTestId('debounced').textContent).toBe('alpha')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByTestId('debounced').textContent).toBe('bravo')
  })

  it('keeps only the latest pending value when updates race', () => {
    const view = render(<DebounceHarness value="a" delayMs={200} />)
    view.rerender(<DebounceHarness value="ab" delayMs={200} />)
    view.rerender(<DebounceHarness value="abc" delayMs={200} />)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(screen.getByTestId('debounced').textContent).toBe('abc')
  })

  it('handles zero delay via async next-tick update', () => {
    const view = render(<DebounceHarness value="one" delayMs={0} />)
    view.rerender(<DebounceHarness value="two" delayMs={0} />)

    expect(screen.getByTestId('debounced').textContent).toBe('one')
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByTestId('debounced').textContent).toBe('two')
  })
})
