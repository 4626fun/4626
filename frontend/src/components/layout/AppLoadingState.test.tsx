// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppLoadingState } from './AppLoadingState'

describe('AppLoadingState', () => {
  it('renders the loader before the loading title and keeps accessible status copy', () => {
    const { container } = render(<AppLoadingState />)
    const loader = container.querySelector('[data-pixel-wave-loader="true"]') as HTMLElement | null
    const heading = screen.getByRole('heading', { name: /loading/i })

    expect(heading).toBeTruthy()
    expect(loader).toBeTruthy()
    expect((loader as HTMLElement).compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/loading your account session/i)
    expect(loader?.style.color).toBe('rgb(var(--brand-primary))')
    expect(container.querySelector('.app-loading-glow')).toBeNull()
    expect(container.querySelector('.app-loading-pill')).toBeNull()
  })
})
