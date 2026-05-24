// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AppLoadingOverlay,
  AppLoadingProvider,
  AppLoadingRegistrar,
} from './AppLoadingOverlay'

describe('AppLoadingOverlay', () => {
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
})
