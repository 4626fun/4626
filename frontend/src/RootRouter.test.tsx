// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockAppOrigin = 'https://app.4626.fun'
let mockHostMode: 'app' | 'marketing' = 'app'

vi.mock('@/lib/env/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env/host')>('@/lib/env/host')
  return {
    ...actual,
    get APP_ORIGIN() {
      return mockAppOrigin
    },
    getHostMode: () => mockHostMode,
  }
})

vi.mock('./App', () => ({
  default: () => <div data-testid="protected-app">protected app</div>,
}))
vi.mock('./web3/Web3Providers', () => ({
  AppQueryProvider: ({ children }: { children: unknown }) => <>{children}</>,
}))

vi.mock('./pages/Home', () => ({
  Home: () => <div data-testid="home-page">home</div>,
}))

vi.mock('./pages/WaitlistInviteEntry', () => ({
  WaitlistInviteEntry: () => <div data-testid="waitlist-invite-entry">waitlist invite</div>,
}))

let RootRouter: (typeof import('./RootRouter'))['RootRouter']

describe('RootRouter', () => {
  beforeEach(async () => {
    vi.resetModules()
    mockAppOrigin = 'https://app.4626.fun'
    mockHostMode = 'app'
    ;({ RootRouter } = await import('./RootRouter'))
  })

  it.each(['/telegram/link', '/telegram/menu'])(
    'redirects %s requests to the standalone html without loading the protected app',
    async (pathname) => {
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={[`${pathname}?tgEntry=link&tgLinkToken=abc123#step=otp`]}>
        <RootRouter />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith('/telegram-link.html?tgEntry=link&tgLinkToken=abc123#step=otp'),
    )
    expect(screen.queryByTestId('protected-app')).toBeNull()
    replaceSpy.mockRestore()
    },
  )

  it('keeps non-telegram routes on the protected app boundary', async () => {
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

  it('does not self-redirect app-only routes when marketing override shares the current origin', async () => {
    mockHostMode = 'marketing'
    mockAppOrigin = 'http://localhost:3000'
    window.history.replaceState({}, '', 'http://localhost:3000/swap')
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/swap']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('protected-app')).toBeTruthy()
    expect(replaceSpy).not.toHaveBeenCalled()
    replaceSpy.mockRestore()
  })
})
