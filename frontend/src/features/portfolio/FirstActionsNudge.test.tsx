// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PORTFOLIO_FIRST_ACTIONS_DISMISS_KEY,
  PortfolioFirstActionsNudge,
  resetPortfolioFirstActionsNudge,
} from './FirstActionsNudge'

function renderWithRouter(enabled = true) {
  return render(
    <MemoryRouter>
      <PortfolioFirstActionsNudge enabled={enabled} />
    </MemoryRouter>,
  )
}

describe('PortfolioFirstActionsNudge', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    window.localStorage.clear()
  })

  it('renders all three action cards by default', () => {
    renderWithRouter()
    expect(screen.getByRole('region', { name: /first actions/i })).toBeTruthy()
    expect(screen.getByText(/Browse creator vaults/)).toBeTruthy()
    expect(screen.getByText(/Swap into a position/)).toBeTruthy()
    expect(screen.getByText(/Deploy your own vault/)).toBeTruthy()
  })

  it('hides itself when enabled=false', () => {
    renderWithRouter(false)
    expect(screen.queryByRole('region', { name: /first actions/i })).toBeNull()
  })

  it('persists dismissal across rerenders via localStorage', () => {
    const { unmount } = renderWithRouter()
    const dismiss = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismiss)
    expect(window.localStorage.getItem(PORTFOLIO_FIRST_ACTIONS_DISMISS_KEY)).toBe('1')
    expect(screen.queryByRole('region', { name: /first actions/i })).toBeNull()
    unmount()

    renderWithRouter()
    expect(screen.queryByRole('region', { name: /first actions/i })).toBeNull()
  })

  it('can be re-enabled via the reset helper on a fresh mount', () => {
    // Reset is intended to be triggered from a help menu that then navigates
    // back to the portfolio, so consumers see the nudge again on the next
    // fresh mount of the component.
    window.localStorage.setItem(PORTFOLIO_FIRST_ACTIONS_DISMISS_KEY, '1')
    const first = renderWithRouter()
    expect(screen.queryByRole('region', { name: /first actions/i })).toBeNull()
    first.unmount()

    resetPortfolioFirstActionsNudge()
    expect(window.localStorage.getItem(PORTFOLIO_FIRST_ACTIONS_DISMISS_KEY)).toBeNull()
    renderWithRouter()
    expect(screen.getByRole('region', { name: /first actions/i })).toBeTruthy()
  })
})
