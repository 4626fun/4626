// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMobileNavScrollHide } from './useMobileNavScrollHide'

function dispatchViewportScroll(scrollTop: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollTop })
  Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, value: scrollTop })
  // Viewport scrolls fire on Document in browsers (not Window).
  document.dispatchEvent(new Event('scroll', { bubbles: true }))
}

function dispatchElementScroll(element: HTMLElement, scrollTop: number) {
  Object.defineProperty(element, 'scrollTop', { configurable: true, value: scrollTop, writable: true })
  element.dispatchEvent(new Event('scroll', { bubbles: true }))
}

describe('useMobileNavScrollHide', () => {
  afterEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, value: 0 })
  })

  it('returns false when disabled', () => {
    const { result } = renderHook(() =>
      useMobileNavScrollHide({ enabled: false, pathname: '/swap' }),
    )
    expect(result.current).toBe(false)
  })

  it('hides on scroll down past threshold and shows on scroll up', () => {
    const { result } = renderHook(() =>
      useMobileNavScrollHide({ enabled: true, pathname: '/swap' }),
    )

    act(() => {
      dispatchViewportScroll(0)
      dispatchViewportScroll(40)
    })
    expect(result.current).toBe(true)

    act(() => {
      dispatchViewportScroll(20)
    })
    expect(result.current).toBe(false)
  })

  it('always shows near the top of the scroller', () => {
    const { result } = renderHook(() =>
      useMobileNavScrollHide({ enabled: true, pathname: '/deploy' }),
    )

    act(() => {
      dispatchViewportScroll(0)
      dispatchViewportScroll(80)
    })
    expect(result.current).toBe(true)

    act(() => {
      dispatchViewportScroll(8)
    })
    expect(result.current).toBe(false)
  })

  it('tracks nested overflow containers via capture-phase scroll', () => {
    const nested = document.createElement('div')
    document.body.appendChild(nested)

    const { result } = renderHook(() =>
      useMobileNavScrollHide({ enabled: true, pathname: '/vault/1' }),
    )

    act(() => {
      dispatchElementScroll(nested, 0)
      dispatchElementScroll(nested, 48)
    })
    expect(result.current).toBe(true)

    act(() => {
      dispatchElementScroll(nested, 30)
    })
    expect(result.current).toBe(false)

    nested.remove()
  })

  it('resets to visible when pathname changes', () => {
    const { result, rerender } = renderHook(
      ({ pathname }) => useMobileNavScrollHide({ enabled: true, pathname }),
      { initialProps: { pathname: '/swap' } },
    )

    act(() => {
      dispatchViewportScroll(0)
      dispatchViewportScroll(100)
    })
    expect(result.current).toBe(true)

    rerender({ pathname: '/explore/creators' })
    expect(result.current).toBe(false)
  })

  it('does not hide from a stale pre-navigation scroll baseline', () => {
    const { result, rerender } = renderHook(
      ({ pathname }) => useMobileNavScrollHide({ enabled: true, pathname }),
      { initialProps: { pathname: '/swap' } },
    )

    act(() => {
      dispatchViewportScroll(0)
      dispatchViewportScroll(120)
    })
    expect(result.current).toBe(true)

    rerender({ pathname: '/deploy' })
    expect(result.current).toBe(false)

    // First scroll after navigation only seeds the baseline; no hide yet.
    act(() => {
      dispatchViewportScroll(120)
    })
    expect(result.current).toBe(false)

    act(() => {
      dispatchViewportScroll(140)
    })
    expect(result.current).toBe(true)
  })

  it('resets to visible when disabled after being hidden', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useMobileNavScrollHide({ enabled, pathname: '/swap' }),
      { initialProps: { enabled: true } },
    )

    act(() => {
      dispatchViewportScroll(0)
      dispatchViewportScroll(90)
    })
    expect(result.current).toBe(true)

    rerender({ enabled: false })
    expect(result.current).toBe(false)
  })
})
