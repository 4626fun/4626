import { describe, expect, it } from 'vitest'

import { computeAcceptedFromAllowlist, resolveAllowlistMode } from './App'

describe('allowlist access resolution', () => {
  it('fails closed when allowlist mode is unresolved', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: null, modeFromAddress: null })
    expect(mode).toBe('unknown')
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: true })).toBe(false)
  })

  it('accepts all sessions when allowlist mode is disabled', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: 'disabled', modeFromAddress: null })
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: false })).toBe(true)
  })

  it('requires address allowlist approval when mode is enforced', () => {
    const mode = resolveAllowlistMode({ modeFromGlobal: 'enforced', modeFromAddress: null })
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: false })).toBe(false)
    expect(computeAcceptedFromAllowlist({ mode, allowlisted: true })).toBe(true)
  })
})
