// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/host')>('@/lib/host')
  return {
    ...actual,
    APP_ORIGIN: 'https://v1.4626.fun',
    getHostMode: () => 'app' as const,
  }
})

vi.mock('./ProtectedApp', () => ({
  default: () => <div data-testid="protected-app">protected app</div>,
}))

vi.mock('./pages/Home', () => ({
  Home: () => <div data-testid="home-page">home</div>,
}))

vi.mock('./pages/WaitlistInviteEntry', () => ({
  WaitlistInviteEntry: () => <div data-testid="waitlist-invite-entry">waitlist invite</div>,
}))

import { RootRouter } from './RootRouter'

describe('RootRouter', () => {
  it('redirects telegram link requests to the standalone html without loading ProtectedApp', async () => {
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/telegram/link?tgEntry=link&tgLinkToken=abc123#step=otp']}>
        <RootRouter />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith('/telegram-link.html?tgEntry=link&tgLinkToken=abc123#step=otp'),
    )
    expect(screen.queryByTestId('protected-app')).toBeNull()
    replaceSpy.mockRestore()
  })

  it('keeps non-telegram routes on ProtectedApp', async () => {
    render(
      <MemoryRouter initialEntries={['/swap']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('protected-app')).toBeTruthy()
  })

  it('routes the root marketing path through Home', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-page')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })
})
