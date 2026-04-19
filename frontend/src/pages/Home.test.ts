// @vitest-environment happy-dom

import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  META: {
    home: {
      title: 'Home',
      description: 'Home',
    },
  },
}))

vi.mock('@/lib/env/host', () => ({
  getHostMode: () => 'marketing',
  MARKETING_ORIGIN: 'https://4626.fun',
}))

vi.mock('@/features/home/vault-flow/VaultFlowScroll', () => ({
  VaultFlowScroll: ({ depositTokens, shareTokens }: { depositTokens: string; shareTokens: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'vault-flow-scroll' },
      `${depositTokens} TOKEN · ${shareTokens}`,
    ),
}))

import { Home } from './Home'

describe('Home', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hard-redirects to the marketing origin on marketing host mode', () => {
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(replaceSpy).toHaveBeenCalledWith('https://4626.fun')
  })

  it('does not render waitlist flow or providers when redirecting', () => {
    vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
    expect(screen.queryByTestId('privy-provider')).toBeNull()
    expect(screen.queryByTestId('web3-providers')).toBeNull()
  })

  it('does not render the inline waitlist button during marketing redirect', () => {
    vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByRole('button', { name: /join waitlist/i })).toBeNull()
  })

  it('does not render launch-flow content during marketing redirect', () => {
    vi.spyOn(window.location, 'replace').mockImplementation(() => {})

    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByTestId('vault-flow-scroll')).toBeNull()
    expect(screen.queryByRole('link', { name: /join waitlist/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Learn more about the launch flow/i })).toBeNull()
  })
})
