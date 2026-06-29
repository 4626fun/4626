import { describe, expect, it } from 'vitest'

import { deriveCreatorShareHookPdas } from './creatorShareHookPdas.js'

describe('deriveCreatorShareHookPdas', () => {
  it('derives deterministic PDAs for a hook mint', () => {
    const mint = '5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv'
    const pdas = deriveCreatorShareHookPdas(mint)
    expect(pdas).not.toBeNull()
    expect(pdas?.hookMint).toBe(mint)
    expect(pdas?.creatorConfig).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(pdas?.pendingEntries).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    expect(pdas?.winnerRecord).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
  })

  it('returns null for invalid mint input', () => {
    expect(deriveCreatorShareHookPdas('')).toBeNull()
    expect(deriveCreatorShareHookPdas('not-a-pubkey')).toBeNull()
  })
})
