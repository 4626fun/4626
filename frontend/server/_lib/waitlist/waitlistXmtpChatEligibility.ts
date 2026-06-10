import { summarizeBaseSubAccount } from '../wallet/executionTrack.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function normalizeMemberAddress(value: string | null): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!ADDRESS_RE.test(raw)) return null
  return raw as `0x${string}`
}

export type WaitlistChatExecutionTrack = 'legacy-owner-install' | 'sub-account' | 'none-yet'

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
  subAccountFlowEnabled?: boolean
  ownerCheckFailed?: boolean
}

function resolveChatExecutionTrack(input: {
  canonicalCswAddress: `0x${string}`
  baseSubAccountAddress: `0x${string}` | null
  embeddedIsOwnerOfParent: boolean
  subAccountFlowEnabled: boolean
}): WaitlistChatExecutionTrack {
  if (input.embeddedIsOwnerOfParent) return 'legacy-owner-install'
  if (input.subAccountFlowEnabled) {
    const summary = summarizeBaseSubAccount({
      canonicalCswAddress: input.canonicalCswAddress,
      baseSubAccountAddress: input.baseSubAccountAddress,
    })
    if (summary.registered) return 'sub-account'
  }
  return 'none-yet'
}

export function resolveWaitlistChatEligibilitySnapshot(
  input: ResolveWaitlistChatEligibilityInput,
): WaitlistChatEligibilitySnapshot {
  const subAccountFlowEnabled = input.subAccountFlowEnabled ?? false

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
    canonicalCswAddress: input.canonicalCswAddress,
    baseSubAccountAddress: input.baseSubAccountAddress,
    embeddedIsOwnerOfParent: input.embeddedIsOwnerOfParent,
    subAccountFlowEnabled,
  })

  const subAccountSummary = summarizeBaseSubAccount({
    canonicalCswAddress: input.canonicalCswAddress,
    baseSubAccountAddress: input.baseSubAccountAddress,
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

  if (executionTrack === 'sub-account' && subAccountSummary.address) {
    const xmtpMemberAddress = normalizeMemberAddress(subAccountSummary.address)
    return {
      canonicalCswAddress: input.canonicalCswAddress,
      embeddedEoaAddress: input.embeddedEoaAddress,
      baseSubAccountAddress: xmtpMemberAddress,
      executionTrack,
      xmtpMemberAddress,
      chatReady: Boolean(xmtpMemberAddress),
      embeddedIsOwnerOfParent: input.embeddedIsOwnerOfParent,
      joinBlockedReason: xmtpMemberAddress ? null : 'sub_account_not_registered',
    }
  }

  const joinBlockedReason =
    subAccountFlowEnabled && !input.embeddedIsOwnerOfParent
      ? 'sub_account_not_registered'
      : 'embedded_owner_not_installed'

  return {
    canonicalCswAddress: input.canonicalCswAddress,
    embeddedEoaAddress: input.embeddedEoaAddress,
    baseSubAccountAddress: input.baseSubAccountAddress,
    executionTrack: 'none-yet',
    xmtpMemberAddress: null,
    chatReady: false,
    embeddedIsOwnerOfParent: input.embeddedIsOwnerOfParent,
    joinBlockedReason,
  }
}
