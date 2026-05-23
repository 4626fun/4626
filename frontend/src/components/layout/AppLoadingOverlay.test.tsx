// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  AppLoadingOverlay,
  AppLoadingProvider,
  AppLoadingRegistrar,
} from './AppLoadingOverlay'

describe('AppLoadingOverlay', () => {
  it('shows one unified bootstrap headline for session registrations', () => {
    render(
      <AppLoadingProvider>
        <AppLoadingRegistrar intent="session" />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /loading/i })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /syncing session/i })).toBeNull()
  })

  it('keeps the overlay mounted while multiple registrations overlap', () => {
    const { rerender } = render(
      <AppLoadingProvider>
        <AppLoadingRegistrar intent="session" />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /loading/i })).toBeTruthy()

    rerender(
      <AppLoadingProvider>
        <AppLoadingRegistrar intent="page" />
        <AppLoadingOverlay />
      </AppLoadingProvider>,
    )

    expect(screen.getByRole('heading', { name: /loading/i })).toBeTruthy()
  })
})
