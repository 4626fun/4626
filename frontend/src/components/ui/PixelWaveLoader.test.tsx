// @vitest-environment happy-dom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PixelWaveLoader } from './PixelWaveLoader'

describe('PixelWaveLoader', () => {
  it('renders a 5x5 matrix by default', () => {
    const { container } = render(<PixelWaveLoader />)

    const loader = container.querySelector('[data-pixel-wave-loader="true"]')
    const cells = container.querySelectorAll('[data-pixel-wave-cell="true"]')

    expect(loader).toBeTruthy()
    expect(cells).toHaveLength(25)
    expect(loader?.getAttribute('aria-hidden')).toBe('true')
  })

  it('normalizes numeric size and generates a left-to-right stagger', () => {
    const { container } = render(<PixelWaveLoader duration={660} gridSize={3} size={36} />)
    const loader = container.querySelector('[data-pixel-wave-loader="true"]') as HTMLElement | null
    const cells = Array.from(container.querySelectorAll('[data-pixel-wave-cell="true"]')) as HTMLElement[]

    expect(loader?.style.width).toBe('36px')
    expect(loader?.style.height).toBe('36px')
    expect(loader?.style.getPropertyValue('--dotm-wave-duration')).toBe('660ms')
    expect(cells.map((cell) => cell.style.animationDelay)).toEqual([
      '0ms',
      '100ms',
      '200ms',
      '0ms',
      '100ms',
      '200ms',
      '0ms',
      '100ms',
      '200ms',
    ])
  })

  it('repeats shorter custom delay arrays across larger grids', () => {
    const { container } = render(<PixelWaveLoader delays={[0, 80]} gridSize={2} />)
    const cells = Array.from(container.querySelectorAll('[data-pixel-wave-cell="true"]')) as HTMLElement[]

    expect(cells.map((cell) => cell.style.animationDelay)).toEqual(['0ms', '80ms', '0ms', '80ms'])
  })

  it('supports larger grids without throwing away custom styling', () => {
    const { container } = render(<PixelWaveLoader color="#8bd3ff" gridSize={4} size="2.5rem" />)
    const loader = container.querySelector('[data-pixel-wave-loader="true"]') as HTMLElement | null

    expect(screen.queryAllByText(/./)).toHaveLength(0)
    expect(loader?.style.color).toBe('#8bd3ff')
    expect(loader?.style.width).toBe('2.5rem')
    expect(container.querySelectorAll('[data-pixel-wave-cell="true"]')).toHaveLength(16)
  })
})
