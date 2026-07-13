// @vitest-environment happy-dom

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let mockAppOrigin = 'https://app.4626.fun'
let mockHostMode: 'app' | 'marketing' | 'alfaclub' = 'app'
const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

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

vi.mock('@/lib/api/apiBase', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('./App', () => ({
  default: () => <div data-testid="protected-app">protected app</div>,
}))
vi.mock('./web3/AppQueryProvider', () => ({
  AppQueryProvider: ({ children }: { children: unknown }) => (
    <div data-testid="app-query-provider">{children as never}</div>
  ),
}))

vi.mock('@/app/alfaclubHostRoutes', () => ({
  AlfaClubHostApp: () => <div data-testid="alfaclub-host-app">alfaclub host</div>,
  AlfaClubHostRedirect: () => <div data-testid="alfaclub-host-redirect">redirect</div>,
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
    apiFetchMock.mockReset()
    window.history.replaceState({}, '', '/')
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
    mockHostMode = 'marketing'

    render(
      <MemoryRouter initialEntries={['/']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-page')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })

  it('does not route AlfaClub host traffic through the marketing Home shell', async () => {
    mockHostMode = 'alfaclub'

    render(
      <MemoryRouter initialEntries={['/rooms']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('home-page')).toBeNull()
    expect(await screen.findByTestId('alfaclub-host-app')).toBeTruthy()
    expect(screen.getByTestId('app-query-provider')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })

  it('does not self-redirect app-only routes when marketing override shares the current origin', async () => {
    mockHostMode = 'marketing'
    mockAppOrigin = window.location.origin
    window.history.replaceState({}, '', '/swap')
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

  it('hands the authenticated session to the app host for marketing app routes', async () => {
    mockHostMode = 'marketing'
    apiFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { code: 'handoff-code' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/swap']}>
        <RootRouter />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith(
        'https://app.4626.fun/swap?cv_handoff=handoff-code',
      ),
    )
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/auth/handoff/create',
      expect.objectContaining({
        method: 'POST',
        withCredentials: true,
      }),
    )
    expect(screen.queryByTestId('protected-app')).toBeNull()
    replaceSpy.mockRestore()
  })
})
