// @vitest-environment happy-dom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
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
  useScroll: () => ({ scrollYProgress: 0 }),
  useSpring: <T,>(value: T) => value,
  useTransform: () => 0,
  useMotionTemplate: () => '',
  useMotionValueEvent: () => {},
  useReducedMotion: () => false,
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
  WaitlistFlow: ({
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

vi.mock('@/components/home/VaultFlowScroll', () => ({
  VaultFlowScroll: ({ depositTokens, shareTokens }: { depositTokens: string; shareTokens: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'vault-flow-scroll' },
      `${depositTokens} TOKEN · ${shareTokens}`,
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
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('no')
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-suppress-auth-shell')).toBe('no')
    expect(screen.queryByRole('button', { name: /join waitlist/i })).toBeNull()
    expect(window.location.pathname).toBe('/')
  })

  it('clears any stale referral code before opening the homepage waitlist flow', async () => {
    const user = userEvent.setup()
    window.sessionStorage.clear()
    window.sessionStorage.setItem('cv:waitlist:referral_code', 'FRIEND42')

    render(React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(Home)))

    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    expect(window.sessionStorage.getItem('cv:waitlist:referral_code')).toBeNull()
  })

  it('opens the homepage waitlist flow from stored auth intent', async () => {
    window.sessionStorage.clear()
    window.sessionStorage.setItem('cv:waitlist:auth_armed', '1')
    window.sessionStorage.setItem('cv:waitlist:auth_auto_start', '1')

    render(React.createElement(MemoryRouter, { initialEntries: ['/'] }, React.createElement(Home)))

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('yes')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBeNull()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_auto_start')).toBeNull()
  })

  it('does not render the waitlist flow before explicit user intent', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
  })

  it('shows the current launch mechanics and token flow', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getByTestId('vault-flow-scroll')).toBeTruthy()
    expect(screen.getAllByText(/50,000,000 TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/50,000,000\s*(?:■\s*)?TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CCA launch/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Redeem/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /How it works/i })).toBeTruthy()
  })
})
