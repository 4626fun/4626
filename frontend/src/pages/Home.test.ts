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

vi.mock('@/components/ui/Modal', () => ({
  Modal: ({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) => (open ? React.createElement('div', { role: 'dialog' }, children) : null),
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
  }: {
    sectionId?: string
    variant?: string
    autoStartAuth?: boolean
  }) => (
    React.createElement(
      'div',
      {
        'data-testid': 'waitlist-flow',
        'data-variant': variant ?? 'embedded',
        'data-auto-start': autoStartAuth ? 'yes' : 'no',
      },
      sectionId ?? 'waitlist-flow',
    )
  ),
}))

vi.mock('@/components/waitlist/PublicWaitlistOverview', () => ({
  PublicWaitlistOverview: ({
    onContinueWithEmail,
  }: {
    onContinueWithEmail: () => void
  }) => (
    React.createElement(
      'div',
      { 'data-testid': 'public-waitlist-overview' },
      React.createElement('div', null, 'Sign up for the waitlist by verifying your email address.'),
      React.createElement(
        'button',
        { type: 'button', onClick: onContinueWithEmail },
        'Continue with email',
      ),
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

  it('opens a quiet modal first and only mounts auth after explicit in-modal intent', async () => {
    const user = userEvent.setup()
    window.sessionStorage.clear()

    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(await screen.findByTestId('public-waitlist-overview')).toBeTruthy()
    expect(screen.queryByTestId('waitlist-flow')).toBeNull()

    await user.click(screen.getByRole('button', { name: /continue with email/i }))

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-variant')).toBe('modal')
    expect(screen.getByTestId('waitlist-flow').getAttribute('data-auto-start')).toBe('yes')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBeNull()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_auto_start')).toBeNull()
  })

  it('does not render the embedded waitlist shell on the homepage anymore', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByText(/sign up for the waitlist by verifying your email address/i)).toBeNull()
    expect(screen.queryByText(/start access setup without leaving the page/i)).toBeNull()
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
