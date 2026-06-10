export type AccountLinkProvider =
  | 'google'
  | 'apple'
  | 'twitter'
  | 'telegram'
  | 'tiktok'
  | 'external_eoa'
  | 'email'
  | 'zora_cross_app'

export type AccountScore = {
  /** Public points total (leaderboard, tiers, tray, waitlist, lottery). */
  points: number
  tier: number
}

export type AccountCreatorCoin = {
  address: string
  name?: string | null
  symbol?: string | null
  imageUrl?: string | null
}

export type AccountSignals = {
  linked: boolean
  canonicalCswAddress: string | null
  baseSubAccount: {
    address: string | null
    registered: boolean
    isDistinctFromCsw: boolean
  }
  executionTrack: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet'
  privyEmbeddedEoaIsOwnerOfCanonicalCsw: boolean | null
  creatorCoin: AccountCreatorCoin | null
  zoraHandle: string | null
  lastResolvedAt: string | null
}

export type AccountSetupMe = {
  privyUserId: string
  email: string | null
  emailVerified: boolean
  appAccessStatus: string | null
  baseSubAccount: string | null
  linkedMethods: Record<string, string[]>
  accountSignals: AccountSignals
  score: AccountScore
}

export type ZoraLinkStatusResponse = {
  zoraLinked: boolean
  zoraCrossAppAccounts: Array<{ address: string; providerAppId: string }>
}

export type ZoraResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: AccountCreatorCoin | null
  zoraHandle: string | null
}

export type AccountSetupInitialData = {
  me: AccountSetupMe
  zoraStatus: ZoraLinkStatusResponse | null
}

export type SmartWalletOwnersResponse = {
  smartWallet: `0x${string}`
  ownerCount: number
  nextOwnerIndex: number | null
  owners: Array<{
    index: number
    ownerBytes: `0x${string}`
    ownerAddress: `0x${string}` | null
    isAddressOwner: boolean
  }>
}

export type OwnerAuthorityState = {
  phase:
    | 'blocked'
    | 'canonical_wallet'
    | 'owner_connected'
    | 'needs_base'
    | 'check_wallet'
    | 'wrong_wallet'
    | 'needs_wallet'
  label: string
  hint: string
  detail: string
  badgeClass: string
}

export type OwnerChecklistItem = {
  title: string
  description: string
  state: 'complete' | 'active' | 'blocked'
}

export type OwnerInstallResumeState = {
  requested: boolean
  source: string | null
}

export type ProviderRow = {
  provider: AccountLinkProvider
  label: string
  hint: string
}

export type ConnectedOwnerState = {
  value: boolean | null
  reason:
    | 'idle'
    | 'ok'
    | 'network_mismatch'
    | 'missing_params'
    | 'read_failed'
    | 'passkey_requires_base_app'
    | 'csw_not_owner_signer'
}

export type CswOwnersState = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  owners: SmartWalletOwnersResponse['owners']
  error: string | null
}
