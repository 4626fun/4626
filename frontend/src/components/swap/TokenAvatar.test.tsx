// @vitest-environment happy-dom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TokenAvatar } from './TokenAvatar'

describe('TokenAvatar', () => {
  it('resets failure state when token candidates change', () => {
    const view = render(
      <TokenAvatar
        symbol="AAA"
        token={{
          address: 'invalid-token-address',
          logoUrl: 'https://cdn.example.com/broken-a.png',
          logoUrls: [],
        }}
      />,
    )

    const firstImage = screen.getByRole('img', { name: 'AAA' }) as HTMLImageElement
    fireEvent.error(firstImage)
    expect(screen.getByText('AA')).toBeTruthy()

    view.rerender(
      <TokenAvatar
        symbol="BBB"
        token={{
          address: '0x2222222222222222222222222222222222222222',
          logoUrl: 'https://cdn.example.com/good-b.png',
          logoUrls: [],
        }}
      />,
    )

    const nextImage = screen.getByRole('img', { name: 'BBB' }) as HTMLImageElement
    expect(nextImage.getAttribute('src')).toContain('good-b.png')
  })
})
