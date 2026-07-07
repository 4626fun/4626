export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'base-app-direct' | 'none-yet'

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
  /** `profile_wallets.canonical_source` — only `base_account` skips owner install. */
  canonicalSource?: string | null
}

function isBaseAppPopulationCanonicalSource(canonicalSource: string | null | undefined): boolean {
  return String(canonicalSource ?? '').trim() === 'base_account'
}

function resolveChatExecutionTrack(input: {
  embeddedIsOwnerOfParent: boolean
  canonicalSource?: string | null
}): WaitlistChatExecutionTrack {
  if (input.embeddedIsOwnerOfParent) return 'legacy-owner-install'
  if (isBaseAppPopulationCanonicalSource(input.canonicalSource)) return 'base-app-direct'
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
    canonicalSource: input.canonicalSource,
  })

  if (executionTrack === 'none-yet') {
    return {
      canonicalCswAddress: input.canonicalCswAddress,
      embeddedEoaAddress: input.embeddedEoaAddress,
      baseSubAccountAddress: input.baseSubAccountAddress,
      executionTrack,
      xmtpMemberAddress: null,
      chatReady: false,
      embeddedIsOwnerOfParent: false,
      joinBlockedReason: 'embedded_owner_not_installed',
    }
  }

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
    executionTrack,
    xmtpMemberAddress: input.canonicalCswAddress,
    chatReady: true,
    embeddedIsOwnerOfParent: false,
    joinBlockedReason: null,
  }
}
