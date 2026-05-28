import { describe, expect, it } from 'vitest'

import {
  assessCswUserOpFunding,
  MIN_CSW_USEROP_FUNDING_WEI,
  mapAddOwnerFundingErrorMessage,
} from './cswEntryPointFunding.js'

describe('assessCswUserOpFunding', () => {
  it('flags zero combined balance', () => {
    const result = assessCswUserOpFunding({
      cswNativeWei: 0n,
      entryPointDepositWei: 0n,
      totalAvailableWei: 0n,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('zero')
  })

  it('flags balance below soft minimum', () => {
    const result = assessCswUserOpFunding({
      cswNativeWei: MIN_CSW_USEROP_FUNDING_WEI - 1n,
      entryPointDepositWei: 0n,
      totalAvailableWei: MIN_CSW_USEROP_FUNDING_WEI - 1n,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('low')
  })

  it('passes when native + deposit meets minimum', () => {
    const result = assessCswUserOpFunding({
      cswNativeWei: MIN_CSW_USEROP_FUNDING_WEI,
      entryPointDepositWei: 0n,
      totalAvailableWei: MIN_CSW_USEROP_FUNDING_WEI,
    })
    expect(result.ok).toBe(true)
  })
})

describe('mapAddOwnerFundingErrorMessage', () => {
  it('maps Base App insufficient funds copy', () => {
    expect(
      mapAddOwnerFundingErrorMessage(
        new Error('Error generating transaction. Please make sure you have enough funds'),
      ),
    ).toMatch(/Send about 0\.001 ETH/)
  })
})
