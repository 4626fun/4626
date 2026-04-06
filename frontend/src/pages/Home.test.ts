// @vitest-environment happy-dom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

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
  it('renders a link to /waitlist instead of opening an inline flow', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    const link = screen.getByRole('link', { name: /join waitlist/i })
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('/waitlist')
  })

  it('does not render any waitlist flow or providers on the home page', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
    expect(screen.queryByTestId('privy-provider')).toBeNull()
    expect(screen.queryByTestId('web3-providers')).toBeNull()
  })

  it('does not show an inline waitlist button — the CTA is always a link', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByRole('button', { name: /join waitlist/i })).toBeNull()
  })

  it('shows the current launch mechanics and token flow', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getByTestId('vault-flow-scroll')).toBeTruthy()
    expect(screen.getAllByText(/50,000,000 TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/50,000,000\s*(?:■\s*)?TOKEN/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CCA/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Earn yield/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Learn more about the launch flow/i })).toBeTruthy()
  })
})
