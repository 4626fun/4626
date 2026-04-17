import { describe, expect, it } from 'vitest'

import {
  resolveExecutionTrack,
  summarizeBaseSubAccount,
  type BaseSubAccountInput,
  type ExecutionTrackInput,
} from './executionTrack'

const CSW = '0x00000000000000000000000000000000000000aa'
const SUB = '0x00000000000000000000000000000000000000bb'

function summarize(overrides: Partial<BaseSubAccountInput> = {}) {
  return summarizeBaseSubAccount({
    canonicalCswAddress: CSW,
    baseSubAccountAddress: null,
    ...overrides,
  })
}

function track(overrides: Partial<ExecutionTrackInput> = {}) {
  return resolveExecutionTrack({
    canonicalCswAddress: CSW,
    baseSubAccountAddress: null,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
    ...overrides,
  })
}

describe('summarizeBaseSubAccount', () => {
  it('returns a null / not-distinct / not-registered summary when no sub-account is persisted', () => {
    expect(summarize({ baseSubAccountAddress: null })).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
    expect(summarize({ baseSubAccountAddress: '' })).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
    expect(summarize({ baseSubAccountAddress: '   ' })).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
  })

  it('rejects malformed addresses', () => {
    expect(summarize({ baseSubAccountAddress: 'not-an-address' })).toEqual({
      address: null,
      isDistinctFromCsw: false,
      registered: false,
    })
    expect(summarize({ baseSubAccountAddress: '0xdeadbeef' }).address).toBeNull()
  })

  it('treats a sub-account that equals the parent CSW as a legacy backfill (not distinct, not registered)', () => {
    const result = summarize({ baseSubAccountAddress: CSW })
    expect(result.address).toBe(CSW)
    expect(result.isDistinctFromCsw).toBe(false)
    expect(result.registered).toBe(false)
  })

  it('is case-insensitive when comparing against the parent CSW', () => {
    const mixedCase = '0x00000000000000000000000000000000000000AA'
    const result = summarize({ baseSubAccountAddress: mixedCase })
    expect(result.isDistinctFromCsw).toBe(false)
  })

  it('marks a distinct sub-account as registered', () => {
    const result = summarize({ baseSubAccountAddress: SUB })
    expect(result.address).toBe(SUB)
    expect(result.isDistinctFromCsw).toBe(true)
    expect(result.registered).toBe(true)
  })

  it('treats the sub-account as distinct when the canonical CSW is null', () => {
    const result = summarize({
      canonicalCswAddress: null,
      baseSubAccountAddress: SUB,
    })
    expect(result.isDistinctFromCsw).toBe(true)
    expect(result.registered).toBe(true)
  })
})

describe('resolveExecutionTrack', () => {
  it("returns 'none-yet' when the account has neither a real sub-account nor the legacy owner install", () => {
    expect(track()).toBe('none-yet')
    expect(track({ baseSubAccountAddress: CSW })).toBe('none-yet')
    expect(track({ privyEmbeddedEoaIsOwnerOfCanonicalCsw: null })).toBe('none-yet')
  })

  it("returns 'legacy-owner-install' when the embedded EOA is a direct owner and no real sub-account is persisted", () => {
    expect(
      track({
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      }),
    ).toBe('legacy-owner-install')
    // Legacy backfill in the column is still legacy-owner-install, not sub-account.
    expect(
      track({
        baseSubAccountAddress: CSW,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      }),
    ).toBe('legacy-owner-install')
  })

  it("returns 'sub-account' when a real sub-account is persisted and the embedded EOA is not a direct CSW owner", () => {
    expect(
      track({
        baseSubAccountAddress: SUB,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: false,
      }),
    ).toBe('sub-account')
  })

  it("returns 'migration-pending' when both signals are present (legacy user who later set up a sub-account)", () => {
    expect(
      track({
        baseSubAccountAddress: SUB,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: true,
      }),
    ).toBe('migration-pending')
  })
})
