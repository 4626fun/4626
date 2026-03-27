// @vitest-environment happy-dom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, tag: string) =>
        ({
          children,
          initial: _initial,
          animate: _animate,
          transition: _transition,
          whileInView: _whileInView,
          viewport: _viewport,
          ...props
        }: any) => React.createElement(tag, props, children),
    },
  ),
}))

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/lib/host', () => ({
  getHostMode: () => 'marketing',
}))

vi.mock('@/web3/Web3Providers', () => ({
  Web3Providers: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/lib/privy/client', () => ({
  PrivyClientProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

vi.mock('@/components/waitlist/ThinWaitlistFlow', () => ({
  ThinWaitlistFlow: ({
    sectionId,
    variant,
    autoStartAuth,
    suppressAuthShell,
  }: {
    sectionId?: string
    variant?: string
    autoStartAuth?: boolean
    suppressAuthShell?: boolean
  }) => (
    React.createElement(
      'div',
      {
        'data-testid': 'waitlist-flow',
        'data-variant': variant ?? 'embedded',
        'data-auto-start': autoStartAuth ? 'yes' : 'no',
        'data-suppress-auth-shell': suppressAuthShell ? 'yes' : 'no',
      },
      sectionId ?? 'waitlist-flow',
    )
  ),
}))

import { Home } from './Home'

describe('Home', () => {
  it('keeps the homepage waitlist entry on-page', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /join waitlist/i })).toBeNull()
  })

  it('opens the provider-backed waitlist flow on the homepage without routing away', async () => {
    const user = userEvent.setup()
    window.sessionStorage.clear()

    render(React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(Home)))

    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-variant')).toBe('embedded')
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('yes')
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-suppress-auth-shell')).toBe('yes')
    expect(window.location.pathname).toBe('/')
  })

  it('does not render the waitlist flow before explicit user intent', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
  })

  it('shows the current launch mechanics and token flow', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getAllByText(/50,000,000 TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/50,000,000 ■TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/7 days/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Thursday 00:00 UTC/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/40% creator vesting/i)).toBeTruthy()
    expect(screen.getByText(/20% LP reserve/i)).toBeTruthy()
  })
})
