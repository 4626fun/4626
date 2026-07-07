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

  it('allows base-app-direct users on the parent CSW inbox without embedded-owner install', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: SUB,
      embeddedIsOwnerOfParent: false,
      canonicalSource: 'base_account',
    })
    expect(result.executionTrack).toBe('base-app-direct')
    expect(result.xmtpMemberAddress).toBe(CSW)
    expect(result.chatReady).toBe(true)
    expect(result.joinBlockedReason).toBeNull()
  })

  it('allows base-app-direct users without a sub-account', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
      canonicalSource: 'base_account',
    })
    expect(result.executionTrack).toBe('base-app-direct')
    expect(result.xmtpMemberAddress).toBe(CSW)
    expect(result.chatReady).toBe(true)
    expect(result.joinBlockedReason).toBeNull()
  })

  it('blocks Zora/wallet_sync users until embedded-owner install completes', () => {
    const result = resolveWaitlistChatEligibilitySnapshot({
      canonicalCswAddress: CSW,
      embeddedEoaAddress: EOA,
      baseSubAccountAddress: null,
      embeddedIsOwnerOfParent: false,
      canonicalSource: 'wallet_sync',
    })
    expect(result.executionTrack).toBe('none-yet')
    expect(result.xmtpMemberAddress).toBeNull()
    expect(result.chatReady).toBe(false)
    expect(result.joinBlockedReason).toBe('embedded_owner_not_installed')
  })
})
