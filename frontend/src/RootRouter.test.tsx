// @vitest-environment happy-dom

<<<<<<< HEAD
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
=======
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
>>>>>>> 56704031 (Preserve Telegram standalone entry and probe-noise cleanup)

vi.mock('@/lib/host', async () => {
  const actual = await vi.importActual<typeof import('@/lib/host')>('@/lib/host')
  return {
    ...actual,
    APP_ORIGIN: 'https://v1.4626.fun',
    getHostMode: () => 'app' as const,
  }
})

<<<<<<< HEAD
vi.mock('./App', () => ({
  default: () => <div data-testid="protected-app">protected app</div>,
}))
vi.mock('./web3/Web3Providers', () => ({
  AppQueryProvider: ({ children }: { children: unknown }) => <>{children}</>,
}))
=======
vi.mock('./ProtectedApp', () => ({
  default: () => <div data-testid="protected-app">protected app</div>,
}))
>>>>>>> 56704031 (Preserve Telegram standalone entry and probe-noise cleanup)

vi.mock('./pages/Home', () => ({
  Home: () => <div data-testid="home-page">home</div>,
}))

<<<<<<< HEAD
vi.mock('./pages/WaitlistInviteEntry', () => ({
  WaitlistInviteEntry: () => <div data-testid="waitlist-invite-entry">waitlist invite</div>,
}))

let RootRouter: (typeof import('./RootRouter'))['RootRouter']

describe('RootRouter', () => {
  beforeEach(async () => {
    vi.resetModules()
    ;({ RootRouter } = await import('./RootRouter'))
  })

  it.each(['/telegram/link', '/telegram/menu'])(
    'redirects %s requests to the standalone html without loading the protected app',
    async (pathname) => {
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={[`${pathname}?tgEntry=link&tgLinkToken=abc123#step=otp`]}>
=======
vi.mock('./pages/TelegramMenuEntry', () => ({
  TelegramMenuEntryRoute: () => <div data-testid="telegram-menu-entry">telegram menu entry</div>,
}))

import { RootRouter } from './RootRouter'

describe('RootRouter', () => {
  it('routes telegram mini app menu directly without loading ProtectedApp', async () => {
    render(
      <MemoryRouter initialEntries={['/telegram/menu']}>
>>>>>>> 56704031 (Preserve Telegram standalone entry and probe-noise cleanup)
        <RootRouter />
      </MemoryRouter>,
    )

<<<<<<< HEAD
    await waitFor(() =>
      expect(replaceSpy).toHaveBeenCalledWith('/telegram-link.html?tgEntry=link&tgLinkToken=abc123#step=otp'),
    )
    expect(screen.queryByTestId('protected-app')).toBeNull()
    replaceSpy.mockRestore()
    },
  )

  it('keeps non-telegram routes on the protected app boundary', async () => {
=======
    expect(await screen.findByTestId('telegram-menu-entry')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })

  it('keeps non-telegram routes on ProtectedApp', async () => {
>>>>>>> 56704031 (Preserve Telegram standalone entry and probe-noise cleanup)
    render(
      <MemoryRouter initialEntries={['/swap']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('protected-app')).toBeTruthy()
<<<<<<< HEAD
  })

  it('routes the root marketing path through Home', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('home-page')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
=======
    expect(screen.queryByTestId('telegram-menu-entry')).toBeNull()
>>>>>>> 56704031 (Preserve Telegram standalone entry and probe-noise cleanup)
  })
})
