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

  it('allows sub-account users on the app wallet inbox when the flow is enabled', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: SUB,
      embeddedIsOwnerOfParent: false,
      subAccountFlowEnabled: true,
    })
    expect(result.executionTrack).toBe('sub-account')
    expect(result.xmtpMemberAddress).toBe(SUB)
    expect(result.chatReady).toBe(true)
    expect(result.joinBlockedReason).toBeNull()
  })

  it('prefers legacy-owner over sub-account when both are available', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: SUB,
      embeddedIsOwnerOfParent: true,
      subAccountFlowEnabled: true,
    })
    expect(result.executionTrack).toBe('legacy-owner-install')
    expect(result.xmtpMemberAddress).toBe(CSW)
  })

  it('blocks Base App users without sub-account registration when the flow is enabled', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
      subAccountFlowEnabled: true,
    })
    expect(result.executionTrack).toBe('none-yet')
    expect(result.joinBlockedReason).toBe('sub_account_not_registered')
  })

  it('blocks Zora-style users without parent owner install when sub-account flow is disabled', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
      subAccountFlowEnabled: false,
    })
    expect(result.joinBlockedReason).toBe('embedded_owner_not_installed')
  })
})
