// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/seo/PageMeta', () => ({
  PageMeta: () => null,
}))

vi.mock('@/components/alfaclub/CounterTradeStatusPanel', () => ({
  CounterTradeStatusPanel: () => <div data-testid="strategy-status">Live strategy status</div>,
}))

import { AlfaClubInverseAkita } from './AlfaClubInverseAkita'

describe('AlfaClubInverseAkita', () => {
  it('explains the strategy identity, operating loop, and public surfaces', () => {
    render(
      <MemoryRouter>
        <AlfaClubInverseAkita />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'InverseAKITA' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'How the inverse loop works' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Where InverseAKITA lives' })).toBeTruthy()
    expect(screen.getByTestId('strategy-status')).toBeTruthy()

    expect(screen.getByRole('link', { name: /enter room 1659/i }).getAttribute('href')).toBe(
      '/rooms?roomId=1659&tab=inverse',
    )
    expect(screen.getAllByRole('link', { name: /view the agent/i })[0]?.getAttribute('href')).toBe(
      'https://degen.virtuals.io/agents/1213',
    )
    expect(screen.getByRole('link', { name: /open the cabal/i }).getAttribute('href')).toBe(
      'https://cabals.com/cabal/inverseakita',
    )
  })

  it('states the execution and attribution boundaries plainly', () => {
    render(
      <MemoryRouter>
        <AlfaClubInverseAkita />
      </MemoryRouter>,
    )

    expect(screen.getByText('Its own wallet')).toBeTruthy()
    expect(screen.getByText('Risk-gated, not guaranteed')).toBeTruthy()
    expect(screen.getByText('AlfaClub owns opinion context')).toBeTruthy()
    expect(screen.getByText('Hyperliquid owns PnL truth')).toBeTruthy()
  })
})
