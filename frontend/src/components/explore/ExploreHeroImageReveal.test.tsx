import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import { ExploreHeroImageReveal } from './ExploreHeroImageReveal'

vi.mock('framer-motion', () => ({
  useReducedMotion: () => false,
  motion: new Proxy(
    ((component: unknown) => component) as unknown,
    {
      get: (_, tag: string) =>
        ({ children, ...props }: { children?: React.ReactNode }) =>
          React.createElement(tag, props, children),
    },
  ),
}))

describe('ExploreHeroImageReveal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        decode = vi.fn(async () => undefined)
        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders hero image markup with eager loading hints', () => {
    const html = renderToStaticMarkup(
      React.createElement(ExploreHeroImageReveal, {
        src: 'https://example.com/hero.jpg',
        alt: 'Creator hero',
        overlays: React.createElement('div', { 'data-testid': 'overlay' }),
      }),
    )

    expect(html).toContain('https://example.com/hero.jpg')
    expect(html).toContain('Creator hero')
    expect(html).toContain('data-testid="overlay"')
  })
})
