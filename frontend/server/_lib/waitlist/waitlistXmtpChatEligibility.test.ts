import { describe, expect, it } from 'vitest'

import { resolveWaitlistChatEligibilitySnapshot } from './waitlistXmtpChatEligibility.js'

const CSW = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const
const SUB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const
const EOA = '0xcccccccccccccccccccccccccccccccccccccccc' as const

describe('resolveWaitlistChatEligibilitySnapshot', () => {
  it('requires parent CSW', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: null,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
    })
    expect(result.joinBlockedReason).toBe('canonical_csw_missing')
    expect(result.chatReady).toBe(false)
  })

  it('allows legacy-owner users on the parent CSW inbox', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: true,
    })
    expect(result.executionTrack).toBe('legacy-owner-install')
    expect(result.xmtpMemberAddress).toBe(CSW)
    expect(result.chatReady).toBe(true)
    expect(result.joinBlockedReason).toBeNull()
  })

  it('prefers legacy-owner-install when the embedded EOA is a CSW owner even if a sub-account is present', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: SUB,
      embeddedIsOwnerOfParent: true,
    })
    expect(result.executionTrack).toBe('legacy-owner-install')
    expect(result.xmtpMemberAddress).toBe(CSW)
    expect(result.chatReady).toBe(true)
  })

  it('blocks sub-account-only users until the embedded EOA is installed as a CSW owner', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: SUB,
      embeddedIsOwnerOfParent: false,
    })
    expect(result.executionTrack).toBe('none-yet')
    expect(result.xmtpMemberAddress).toBeNull()
    expect(result.chatReady).toBe(false)
    expect(result.joinBlockedReason).toBe('embedded_owner_not_installed')
  })

  it('blocks users without embedded-owner install when no sub-account is present', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
    })
    expect(result.executionTrack).toBe('none-yet')
    expect(result.chatReady).toBe(false)
    expect(result.joinBlockedReason).toBe('embedded_owner_not_installed')
  })
})
