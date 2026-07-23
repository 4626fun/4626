import { describe, expect, it } from 'vitest'

import { requireSolanaMintArgument } from '../../../scripts/ops/solanaMintArgument.js'

describe('requireSolanaMintArgument', () => {
  it('accepts a canonical Solana public key', () => {
    expect(requireSolanaMintArgument('5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv'))
      .toBe('5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv')
  })

  it('rejects shell and Python interpolation payloads', () => {
    expect(() => requireSolanaMintArgument('mint"; touch /tmp/pwned; #')).toThrow('Invalid --mint')
    expect(() => requireSolanaMintArgument("mint'\n__import__('os').system('id')"))
      .toThrow('Invalid --mint')
  })
})
