/**
 * Client-side user-initiated frontend execution track resolution.
 *
 * Parent CSW embedded-owner is the only user-initiated frontend execution
 * lane. Shared by waitlist, swap, and deploy surfaces.
 */

export type UserFrontendExecutionTrack =
  | 'legacy-owner-install'
  | 'base-app-direct'
  | 'none-yet'

export type UserExecutionAccountSignals = {
  linked?: boolean
  zoraHandle?: string | null
  creatorCoin?: { address?: string | null } | null
  canonicalCswAddress?: string | null
  canonicalSource?: string | null
  embeddedEoaAddress?: string | null
  executionTrack?: UserFrontendExecutionTrack
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  /** Set when /accounts/me bootstrap hydration fails while wallet signals are incomplete. */
  walletHydrationError?: string | null
}

function hasLegacyOwnerInstallSigning(
  accountSignals: UserExecutionAccountSignals | undefined,
): boolean {
  return (
    accountSignals?.executionTrack === 'legacy-owner-install' ||
    accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
  )
}

export function isParentCswEmbeddedOwnerReady(params: {
  parentEmbeddedOwnerOnChain?: boolean
  accountSignals?: UserExecutionAccountSignals
}): boolean {
  if (params.parentEmbeddedOwnerOnChain === true) return true
  return hasLegacyOwnerInstallSigning(params.accountSignals)
}

export function isZoraLinkedFromAccountSignals(
  accountSignals: UserExecutionAccountSignals | undefined,
): boolean {
  if (!accountSignals) return false
  if (accountSignals.linked === true) return true
  if (typeof accountSignals.zoraHandle === 'string' && accountSignals.zoraHandle.trim()) return true
  const creatorAddress = accountSignals.creatorCoin?.address
  return typeof creatorAddress === 'string' && creatorAddress.trim().length > 0
}

/** Best-effort EOA-owner hint for routing when a full CSW owner index is unavailable. */
export function inferWaitlistEoaOwnerRoutingHint(params: {
  parentEmbeddedOwnerOnChain?: boolean
  accountSignals?: UserExecutionAccountSignals
  onchainEoaOwnerCount?: number
}): number {
  if (typeof params.onchainEoaOwnerCount === 'number' && params.onchainEoaOwnerCount > 0) {
    return params.onchainEoaOwnerCount
  }
  if (params.parentEmbeddedOwnerOnChain === true) return 1
  if (hasLegacyOwnerInstallSigning(params.accountSignals)) return 1
  return 0
}

export function resolveEffectiveExecutionTrack(params: {
  executionTrack?: UserFrontendExecutionTrack | null
  parentEmbeddedOwnerOnChain?: boolean
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  baseAppDirectConnected?: boolean
}): UserFrontendExecutionTrack {
  if (
    params.parentEmbeddedOwnerOnChain === true ||
    params.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true ||
    params.executionTrack === 'legacy-owner-install'
  ) {
    return 'legacy-owner-install'
  }
  if (params.baseAppDirectConnected || params.executionTrack === 'base-app-direct') {
    return 'base-app-direct'
  }
  return 'none-yet'
}

export type WaitlistStepRoutingContext = {
  embeddedEoaAvailable: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
}

export type AccountChromeExecutionMode = 'parent-csw' | 'none'

export type AccountChromeExecution = {
  mode: AccountChromeExecutionMode
  effectiveExecutionTrack: UserFrontendExecutionTrack
  swapSenderLabel: string | null
  executionLaneTitle: string
  executionLaneDescription: string
}

/**
 * Account chrome (tray, /accounts, swap sender hint) must follow the effective
 * execution track — parent CSW owner is the only execution lane.
 */
export function deriveAccountChromeExecution(params: {
  executionTrack?: UserFrontendExecutionTrack | null
  parentEmbeddedOwnerOnChain?: boolean
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  canonicalCswAddress?: string | null
  baseAppDirectConnected?: boolean
}): AccountChromeExecution {
  const effectiveExecutionTrack = resolveEffectiveExecutionTrack({
    executionTrack: params.executionTrack,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: params.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
    baseAppDirectConnected: params.baseAppDirectConnected,
  })

  if (
    effectiveExecutionTrack === 'legacy-owner-install' ||
    effectiveExecutionTrack === 'base-app-direct'
  ) {
    return {
      mode: 'parent-csw',
      effectiveExecutionTrack,
      swapSenderLabel: 'Sending from your Coinbase Smart Wallet',
      executionLaneTitle: 'Parent smart wallet signing',
      executionLaneDescription:
        'Sponsored swaps and deploys send from your Coinbase Smart Wallet — your canonical identity.',
    }
  }

  return {
    mode: 'none',
    effectiveExecutionTrack,
    swapSenderLabel: null,
    executionLaneTitle: 'Execution lane',
    executionLaneDescription: 'Finish account setup to enable sponsored swaps.',
  }
}

export function buildWaitlistStepRoutingParams<
  TAccount extends {
    emailVerified: boolean
    appAccessStatus: string | null
    accountSignals?: UserExecutionAccountSignals
  },
>(account: TAccount, context: WaitlistStepRoutingContext) {
  const zoraLinked =
    context.zoraLinked ?? isZoraLinkedFromAccountSignals(account.accountSignals)
  const onchainEoaOwnerCount = inferWaitlistEoaOwnerRoutingHint({
    parentEmbeddedOwnerOnChain: context.parentEmbeddedOwnerOnChain,
    accountSignals: account.accountSignals,
    onchainEoaOwnerCount: context.onchainEoaOwnerCount,
  })

  return {
    account,
    embeddedEoaAvailable: context.embeddedEoaAvailable,
    parentEmbeddedOwnerOnChain: context.parentEmbeddedOwnerOnChain,
    zoraLinked,
    onchainEoaOwnerCount,
  }
}
