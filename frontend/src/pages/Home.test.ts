// @vitest-environment happy-dom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
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

import { Home } from './Home'

describe('Home', () => {
  it('keeps the homepage waitlist entry on-page', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getByRole('button', { name: /join waitlist/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /join waitlist/i })).toBeNull()
  })

  it('sends join waitlist directly into the canonical waitlist auth route', async () => {
    const user = userEvent.setup()
    window.sessionStorage.clear()

    render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/', element: React.createElement(Home) }),
          React.createElement(Route, { path: '/waitlist', element: React.createElement('div', null, 'waitlist-route') }),
        ),
      ),
    )

    await user.click(screen.getByRole('button', { name: /join waitlist/i }))

    expect(await screen.findByText('waitlist-route')).toBeTruthy()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBe('1')
    expect(window.sessionStorage.getItem('cv:waitlist:auth_auto_start')).toBe('1')
  })

  it('does not render the homepage-owned waitlist modal anymore', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByText(/join the 4626 waitlist/i)).toBeNull()
    expect(screen.queryByText(/sign up for the waitlist by verifying your email address/i)).toBeNull()
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
