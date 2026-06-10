// @vitest-environment happy-dom

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AppLoadingBootstrapGate,
  AppLoadingOverlay,
  AppLoadingProvider,
  AppLoadingRegistrar,
} from './AppLoadingOverlay'

describe('AppLoadingOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    document.documentElement.classList.remove('app-loading-scroll-lock')
    document.body.classList.remove('app-loading-scroll-lock')
  })

  it('shows one shared Loading headline for every registration', () => {
    render(
      <AppLoadingProvider>
        <AppLoadingRegistrar />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /syncing session/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /redirecting/i })).toBeNull()
    expect(document.body.classList.contains('app-loading-scroll-lock')).toBe(true)
  })

  it('keeps the overlay visible while registrations overlap', () => {
    const { rerender } = render(
      <AppLoadingProvider>
        <AppLoadingRegistrar />
        <AppLoadingRegistrar />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()

    rerender(
      <AppLoadingProvider>
        <AppLoadingRegistrar />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()
  })

  it('debounces overlay hide when registrations hand off', () => {
    const { rerender } = render(
      <AppLoadingProvider>
        <AppLoadingRegistrar />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    rerender(
      <AppLoadingProvider>
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(279)
    })
    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(screen.queryByRole('heading', { name: /^loading\.\.\.$/i })).toBeNull()
    expect(document.body.classList.contains('app-loading-scroll-lock')).toBe(false)
  })

  it('AppLoadingBootstrapGate registers loading without rendering route content', () => {
    render(
      <AppLoadingProvider>
        <AppLoadingBootstrapGate active>
          <div data-testid="route-content">Route body</div>
        </AppLoadingBootstrapGate>
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /^loading\.\.\.$/i })).toBeTruthy()
    expect(screen.queryByTestId('route-content')).toBeNull()
  })
})
