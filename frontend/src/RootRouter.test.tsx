// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
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

vi.mock('./pages/WaitlistPage', () => ({
  WaitlistPage: () => <div data-testid="waitlist-page">waitlist</div>,
}))

vi.mock('./pages/WaitlistInviteEntry', () => ({
  WaitlistInviteEntry: () => <div data-testid="waitlist-invite-entry">waitlist invite</div>,
}))

vi.mock('./pages/TelegramMenuEntry', () => ({
  TelegramMenuEntryRoute: () => <div data-testid="telegram-menu-entry">telegram menu entry</div>,
}))

import { RootRouter } from './RootRouter'

describe('RootRouter', () => {
  it('routes telegram mini app menu directly without loading ProtectedApp', async () => {
    render(
      <MemoryRouter initialEntries={['/telegram/menu']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('telegram-menu-entry')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })

  it('keeps non-telegram routes on ProtectedApp', async () => {
    render(
      <MemoryRouter initialEntries={['/swap']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('protected-app')).toBeTruthy()
    expect(screen.queryByTestId('telegram-menu-entry')).toBeNull()
  })

  it('routes /waitlist through the dedicated waitlist page', async () => {
    render(
      <MemoryRouter initialEntries={['/waitlist']}>
        <RootRouter />
      </MemoryRouter>,
    )

    expect(await screen.findByTestId('waitlist-page')).toBeTruthy()
    expect(screen.queryByTestId('protected-app')).toBeNull()
  })
})
