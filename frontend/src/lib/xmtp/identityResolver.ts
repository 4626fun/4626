import { getAddress, isAddress } from 'viem'

export type XmtpModeOverride = 'EOA' | 'SMART_WALLET' | null | undefined
export type XmtpIdentitySource = 'connected' | 'account-context' | 'waitlist'

type ResolveModePreferredIdentityInput = {
  connectedAddress: string
  modeOverride?: XmtpModeOverride
  accountContextSmartAddress?: string | null
  waitlistCanonicalAddress?: string | null
  waitlistXmtpMemberAddress?: string | null
}

type ResolveModePreferredIdentityResult = {
  preferredAddress: string
  isSmartWalletIdentity: boolean
  source: XmtpIdentitySource
}

function normalizeEvmAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase()
}

export function resolveModePreferredIdentity(
  input: ResolveModePreferredIdentityInput,
): ResolveModePreferredIdentityResult {
  const connected = normalizeEvmAddress(input.connectedAddress) ?? input.connectedAddress.toLowerCase()

  if (input.modeOverride === 'EOA') {
    return {
      preferredAddress: connected,
      isSmartWalletIdentity: false,
      source: 'connected',
    }
  }

  const accountContextSmart = normalizeEvmAddress(input.accountContextSmartAddress)
  if (accountContextSmart && accountContextSmart !== connected) {
    return {
      preferredAddress: accountContextSmart,
      isSmartWalletIdentity: true,
      source: 'account-context',
    }
  }

  const waitlistMember = normalizeEvmAddress(input.waitlistXmtpMemberAddress)
  if (waitlistMember && waitlistMember !== connected) {
    return {
      preferredAddress: waitlistMember,
      isSmartWalletIdentity: true,
      source: 'waitlist',
    }
  }

  const waitlistCanonical = normalizeEvmAddress(input.waitlistCanonicalAddress)
  if (waitlistCanonical && waitlistCanonical !== connected) {
    return {
      preferredAddress: waitlistCanonical,
      isSmartWalletIdentity: true,
      source: 'waitlist',
    }
  }

  return {
    preferredAddress: connected,
    isSmartWalletIdentity: false,
    source: 'connected',
  }
}

export function shouldRequireAuthBackedXmtpIdentity(input: {
  connectedAddress: string
  modeOverride?: XmtpModeOverride
  accountContextSmartAddress?: string | null
  waitlistCanonicalAddress?: string | null
  waitlistXmtpMemberAddress?: string | null
  enforceCanonicalForConnectedSigner: boolean
}): boolean {
  if (input.enforceCanonicalForConnectedSigner) return true
  if (input.modeOverride !== 'SMART_WALLET') return false

  const preferred = resolveModePreferredIdentity({
    connectedAddress: input.connectedAddress,
    modeOverride: input.modeOverride,
    accountContextSmartAddress: input.accountContextSmartAddress,
    waitlistCanonicalAddress: input.waitlistCanonicalAddress ?? null,
    waitlistXmtpMemberAddress: input.waitlistXmtpMemberAddress ?? null,
  })

  return preferred.isSmartWalletIdentity
}
