import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('brand css contract', () => {
  it('defines stable semantic CSS variables and shared utilities', () => {
    const css = readFileSync(resolve(process.cwd(), 'packages/brand-kit/src/styles/brand.css'), 'utf8')
    expect(css).toContain('--brand-primary')
    expect(css).toContain('--vault-bg')
    expect(css).toContain('.glass-card')
  })
})
