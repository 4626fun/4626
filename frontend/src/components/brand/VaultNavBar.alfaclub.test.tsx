// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { VaultNavBarContent } from './VaultNavBar'

describe('VaultNavBar AlfaClub navigation', () => {
  it('shows Keys, Markets, InverseAKITA, and Arena and marks the strategy route active', () => {
    render(
      <MemoryRouter initialEntries={['/inverseakita']}>
        <VaultNavBarContent
          interactive={false}
          location={{ pathname: '/inverseakita' }}
          publicMode={false}
          hostMode="alfaclub"
          isAdmin={false}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Keys' }).getAttribute('href')).toBe(
      '/explore/keys',
    )
    expect(screen.getByRole('link', { name: 'Markets' }).getAttribute('href')).toBe(
      '/explore/pools',
    )
    const inverseLink = screen.getByRole('link', { name: 'InverseAKITA' })
    expect(inverseLink.getAttribute('href')).toBe('/inverseakita')
    expect(inverseLink.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Arena' }).getAttribute('href')).toBe(
      '/arena/positions',
    )
  })

  it('marks Markets active on the pools hub', () => {
    render(
      <MemoryRouter initialEntries={['/explore/pools']}>
        <VaultNavBarContent
          interactive={false}
          location={{ pathname: '/explore/pools' }}
          publicMode={false}
          hostMode="alfaclub"
          isAdmin={false}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Markets' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('link', { name: 'Keys' }).getAttribute('aria-current')).toBeNull()
  })
})
