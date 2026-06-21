export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'none-yet'

export type WaitlistChatEligibilitySnapshot = {
  canonicalCswAddress: `0x${string}` | null
  embeddedEoaAddress: `0x${string}` | null
  baseSubAccountAddress: `0x${string}` | null
  executionTrack: WaitlistChatExecutionTrack
  xmtpMemberAddress: `0x${string}` | null
  chatReady: boolean
  /** True when the embedded EOA is a direct on-chain owner of the parent CSW. */
  embeddedIsOwnerOfParent: boolean
  joinBlockedReason: string | null
}

export type ResolveWaitlistChatEligibilityInput = {
  canonicalCswAddress: `0x${string}` | null
  embeddedEoaAddress: `0x${string}` | null
  baseSubAccountAddress: `0x${string}` | null
  embeddedIsOwnerOfParent: boolean
  ownerCheckFailed?: boolean
}

function resolveChatExecutionTrack(input: {
  embeddedIsOwnerOfParent: boolean
}): WaitlistChatExecutionTrack {
  if (input.embeddedIsOwnerOfParent) return 'legacy-owner-install'
  return 'none-yet'
}

export function resolveWaitlistChatEligibilitySnapshot(
  input: ResolveWaitlistChatEligibilityInput,
): WaitlistChatEligibilitySnapshot {
  if (!input.canonicalCswAddress) {
    return {
      canonicalCswAddress: null,
      embeddedEoaAddress: input.embeddedEoaAddress,
      baseSubAccountAddress: input.baseSubAccountAddress,
      executionTrack: 'none-yet',
      xmtpMemberAddress: null,
      chatReady: false,
      embeddedIsOwnerOfParent: false,
      joinBlockedReason: 'canonical_csw_missing',
    }
  }

  if (!input.embeddedEoaAddress) {
    return {
      canonicalCswAddress: input.canonicalCswAddress,
      embeddedEoaAddress: null,
      baseSubAccountAddress: input.baseSubAccountAddress,
      executionTrack: 'none-yet',
      xmtpMemberAddress: null,
      chatReady: false,
      embeddedIsOwnerOfParent: false,
      joinBlockedReason: 'embedded_eoa_missing',
    }
  }

  if (input.ownerCheckFailed) {
    return {
      canonicalCswAddress: input.canonicalCswAddress,
      embeddedEoaAddress: input.embeddedEoaAddress,
      baseSubAccountAddress: input.baseSubAccountAddress,
      executionTrack: 'none-yet',
      xmtpMemberAddress: null,
      chatReady: false,
      embeddedIsOwnerOfParent: false,
      joinBlockedReason: 'owner_check_failed',
    }
  }

  const executionTrack = resolveChatExecutionTrack({
    embeddedIsOwnerOfParent: input.embeddedIsOwnerOfParent,
  })

  if (executionTrack === 'legacy-owner-install') {
    const xmtpMemberAddress = input.canonicalCswAddress
    return {
      canonicalCswAddress: input.canonicalCswAddress,
      embeddedEoaAddress: input.embeddedEoaAddress,
      baseSubAccountAddress: input.baseSubAccountAddress,
      executionTrack,
      xmtpMemberAddress,
      chatReady: true,
      embeddedIsOwnerOfParent: true,
      joinBlockedReason: null,
    }
  }

  return {
    canonicalCswAddress: input.canonicalCswAddress,
    embeddedEoaAddress: input.embeddedEoaAddress,
    baseSubAccountAddress: input.baseSubAccountAddress,
    executionTrack: 'none-yet',
    xmtpMemberAddress: null,
    chatReady: false,
    embeddedIsOwnerOfParent: input.embeddedIsOwnerOfParent,
    joinBlockedReason: 'embedded_owner_not_installed',
  }
}
