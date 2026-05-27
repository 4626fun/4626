import { describe, expect, it } from 'vitest'
import type { Address } from 'viem'

import { pickOwnerSigner, type CswOwnerResult } from './cswOwnerCheck'

const ADDR = {
  smart: '0x1111111111111111111111111111111111111111' as Address,
  external: '0x2222222222222222222222222222222222222222' as Address,
  embedded: '0x3333333333333333333333333333333333333333' as Address,
}

function result(label: CswOwnerResult['label'], address: Address, isOwner: boolean): CswOwnerResult {
  return { label, address, isOwner }
}

describe('pickOwnerSigner', () => {
  it('prefers connected external owner over smart wallet owner', () => {
    const picked = pickOwnerSigner([
      result('smart_wallet', ADDR.smart, true),
      result('external', ADDR.external, true),
      result('embedded', ADDR.embedded, false),
    ])
    expect(picked?.label).toBe('external')
    expect(picked?.address).toBe(ADDR.external)
  })

  it('falls back to embedded when external is not an owner', () => {
    const picked = pickOwnerSigner([
      result('smart_wallet', ADDR.smart, true),
      result('external', ADDR.external, false),
      result('embedded', ADDR.embedded, true),
    ])
    expect(picked?.label).toBe('embedded')
  })

  it('falls back to smart wallet when only that owner path is available', () => {
    const picked = pickOwnerSigner([
      result('smart_wallet', ADDR.smart, true),
      result('external', ADDR.external, false),
      result('embedded', ADDR.embedded, false),
    ])
    expect(picked?.label).toBe('smart_wallet')
  })
})
