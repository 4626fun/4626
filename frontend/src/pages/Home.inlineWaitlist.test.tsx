// @vitest-environment happy-dom

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  getMarketingBaseUrl: () => 'https://4626.fun',
}))

vi.mock('@/components/waitlist/WaitlistFlowWithProviders', () => ({
  __esModule: true,
  default: ({ sectionId }: { sectionId?: string }) => <div data-testid="waitlist-flow">{sectionId ?? 'waitlist-flow'}</div>,
}))

vi.mock('@/components/waitlist/PublicWaitlistOverview', () => ({
  PublicWaitlistOverview: ({
    onContinueWithEmail,
  }: {
    onContinueWithEmail: () => void
  }) => (
    <div>
      <div>Quiet sign-in, live waitlist context</div>
      <button type="button" onClick={onContinueWithEmail}>
        Continue with email
      </button>
    </div>
  ),
}))

import { Home } from './Home'

describe('Home inline waitlist gating', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  function renderHome(entry = '/waitlist') {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <Home />
      </MemoryRouter>,
    )
  }

  it('keeps the provider-backed waitlist flow dormant on initial render', () => {
    renderHome()

    expect(screen.getByText('Quiet sign-in, live waitlist context')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeTruthy()
    expect(screen.queryByTestId('waitlist-flow')).toBeNull()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBeNull()
  })

  it('mounts the provider-backed waitlist flow only after explicit user intent', async () => {
    const user = userEvent.setup()
    renderHome()

    await user.click(screen.getByRole('button', { name: 'Continue with email' }))

    expect(await screen.findByTestId('waitlist-flow')).toBeTruthy()
    expect(window.sessionStorage.getItem('cv:waitlist:auth_armed')).toBe('1')
  })
})
