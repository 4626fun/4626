// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppLoadingState } from './AppLoadingState'

describe('AppLoadingState', () => {
  it('renders only the pixel-wave loader and accessible status copy without pill chrome', () => {
    const { container } = render(<AppLoadingState />)
    const loader = container.querySelector('[data-pixel-wave-loader="true"]') as HTMLElement | null

    expect(screen.getByRole('heading', { name: /preparing workspace/i })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/loading your account session/i)
    expect(loader).toBeTruthy()
    expect(loader?.style.color).toBe('rgb(var(--brand-primary))')
    expect(container.querySelector('.app-loading-glow')).toBeNull()
    expect(container.querySelector('.app-loading-pill')).toBeNull()
  })
})
