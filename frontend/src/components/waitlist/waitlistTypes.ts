export type Persona = 'creator' | 'user'
export type Variant = 'page' | 'embedded' | 'modal'

// Legacy actions
export type LegacyActionKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'

// New social actions (verified)
export type SocialActionKey = 'baseApp' | 'zora' | 'x' | 'discord' | 'telegram'

// Bonus actions (honor system)
export type BonusActionKey = 'github' | 'tiktok' | 'instagram' | 'reddit'

// Combined action key type
export type ActionKey = LegacyActionKey | SocialActionKey | BonusActionKey

export type ContactPreference = 'wallet' | 'email'
export type VerificationMethod =
  | 'siwe'
  | 'privy'
  | 'solana'
  | 'csw-erc1271'
  | 'siwe-csw-owner'
  | 'privy-embedded-eoa'
  | 'privy-zora-readonly'
  | 'zora-canonical-csw'
export type VerificationClaim = { method: VerificationMethod; subject: string; timestamp: string }
export type OwnerInstallMappingStatus =
  | 'NEEDS_PRIVY_AUTH'
  | 'WAITING_FOR_WALLETS'
  | 'EMBEDDED_WALLET_MISSING'
  | 'EMBEDDED_WALLET_CREATING'
  | 'BASE_SETUP_REQUIRED'
  | 'BASE_SETUP_IN_PROGRESS'
  | 'CANONICAL_RESOLVING'
  | 'CANONICAL_UNRESOLVED'
  | 'OWNER_INSTALL_CHECKING'
  | 'OWNER_INSTALL_REQUIRED'
  | 'OWNER_INSTALLING'
  | 'READY_FOR_OWNER_INSTALL'

export type FlowState = {
  persona: Persona | null
  step: 'persona' | 'verify' | 'email' | 'done'
  contactPreference: ContactPreference
  email: string
  emailOptOut: boolean
  busy: boolean
  error: string | null
  doneEmail: string | null
}

export type VerificationState = {
  verifiedWallet: string | null
  verifiedWalletMethod: VerificationMethod | null
  verifiedSolana: string | null
  privyVerifyBusy: boolean
  privyVerifyError: string | null
  baseSubAccount: string | null
  baseSubAccountBusy: boolean
  baseSubAccountError: string | null
}

export type WaitlistState = {
  creatorCoin: {
    address: string
    symbol: string | null
    coinType: string | null
    imageUrl: string | null
    marketCapUsd: number | null
    volume24hUsd: number | null
    holders: number | null
    priceUsd: number | null
    payoutRecipient: string | null
    ownerWallets: string[]
    canonicalSmartWallet: string | null
  } | null
  creatorCoinDeclaredMissing: boolean
  creatorCoinBusy: boolean
  claimCoinBusy: boolean
  claimCoinError: string | null
  referralCodeTaken: boolean
  claimReferralCode: string
  inviteToast: string | null
  inviteTemplateIdx: number
  referralCode: string | null
  shareBusy: boolean
  shareToast: string | null
  actionsDone: Record<ActionKey, boolean>
  miniAppAddSupported: boolean | null
  // Owner-install prerequisites from waitlist verification.
  embeddedEoaAddress: string | null
  zoraProviderAddresses: string[]
  canonicalZoraCswAddress: string | null
  canonicalZoraCswUnresolvedReason: string | null
  mappingStatus: OwnerInstallMappingStatus
  mappingError: string | null
  // CSW linking status
  cswLinked: boolean
  cswLinkBusy: boolean
  cswLinkError: string | null
  // CSW ERC-1271 ownership proof
  cswProofVerified: boolean
  cswProofBusy: boolean
  cswProofError: string | null
  waitlistPosition: {
    borderTier: number
    points: {
      total: number
      invite: number
      signup: number
      tasks: number
      csw: number          // Points from CSW linking
      social: number       // Points from verified social actions
      bonus: number        // Points from honor system actions
    }
    rank: { invite: number | null; total: number | null }
    totalCount: number
    totalAheadInvite: number | null
    percentileInvite: number | null
    referrals: {
      qualifiedCount: number     // Referrals who linked CSW
      pendingCount: number       // Referrals who only signed up
      pendingCountCapped: number
      pendingCap: number
    }
  } | null
}
