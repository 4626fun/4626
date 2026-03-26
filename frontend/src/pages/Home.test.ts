// @vitest-environment happy-dom

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

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
  it('links marketing users to the dedicated waitlist page', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.getByRole('link', { name: /join waitlist/i }).getAttribute('href')).toBe('/waitlist')
  })

  it('does not render the embedded waitlist shell on the homepage anymore', () => {
    render(React.createElement(MemoryRouter, null, React.createElement(Home)))

    expect(screen.queryByText(/quiet sign-in, live waitlist context/i)).toBeNull()
    expect(screen.queryByText(/start access setup without leaving the page/i)).toBeNull()
  })
})
