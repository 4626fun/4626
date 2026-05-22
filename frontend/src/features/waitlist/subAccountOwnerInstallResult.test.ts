import { describe, expect, it } from 'vitest'

import { isSubAccountOwnerInstallSucceeded } from './subAccountOwnerInstallResult'

describe('isSubAccountOwnerInstallSucceeded', () => {
  it('returns false when registration did not succeed', () => {
    expect(isSubAccountOwnerInstallSucceeded(null)).toBe(false)
    expect(isSubAccountOwnerInstallSucceeded({ registered: false })).toBe(false)
  })

  it('returns true when the embedded EOA is already owner or owner install succeeded on-chain', () => {
    expect(
      isSubAccountOwnerInstallSucceeded({
        registered: true,
        alreadyOwner: true,
        onChainOwnerInstalled: false,
      }),
    ).toBe(true)
    expect(
      isSubAccountOwnerInstallSucceeded({
        registered: true,
        alreadyOwner: false,
        onChainOwnerInstalled: true,
      }),
    ).toBe(true)
  })

  it('returns false when registration succeeded but on-chain owner is still missing', () => {
    expect(
      isSubAccountOwnerInstallSucceeded({
        registered: true,
        alreadyOwner: false,
        onChainOwnerInstalled: false,
      }),
    ).toBe(false)
  })
})
