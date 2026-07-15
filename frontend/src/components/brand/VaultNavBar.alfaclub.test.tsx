// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { VaultNavBarContent } from './VaultNavBar'

describe('VaultNavBar AlfaClub navigation', () => {
  it('shows Rooms, InverseAKITA, and Arena and marks the strategy route active', () => {
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

    expect(screen.getByRole('link', { name: 'Rooms' }).getAttribute('href')).toBe(
      '/explore/rooms',
    )
    const inverseLink = screen.getByRole('link', { name: 'InverseAKITA' })
    expect(inverseLink.getAttribute('href')).toBe('/inverseakita')
    expect(inverseLink.getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Arena' }).getAttribute('href')).toBe(
      '/arena/positions',
    )
  })
})
