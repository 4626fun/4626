/**
 * Client-side user-initiated frontend execution track resolution.
 *
 * Parent CSW embedded-owner (population c) must win over stale sub-account DB
 * state (population b). Shared by waitlist, swap, and deploy surfaces.
 */

export type UserFrontendExecutionTrack =
  | 'sub-account'
  | 'legacy-owner-install'
  | 'migration-pending'
  | 'none-yet'

export type UserExecutionAccountSignals = {
  linked?: boolean
  zoraHandle?: string | null
  creatorCoin?: { address?: string | null } | null
  canonicalCswAddress?: string | null
  executionTrack?: UserFrontendExecutionTrack
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  baseSubAccount?: {
    address?: string | null
    registered?: boolean
    isDistinctFromCsw?: boolean
  }
}

function hasLegacyOwnerInstallSigning(
  accountSignals: UserExecutionAccountSignals | undefined,
): boolean {
  return (
    accountSignals?.executionTrack === 'legacy-owner-install' ||
    accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
  )
}

/** Population (c): embedded EOA is a direct owner on the parent CSW — not Base App sub-account. */
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

export function shouldUseBaseAppSubAccountPath(params: {
  subAccountFlowEnabled: boolean
  parentEmbeddedOwnerOnChain?: boolean
  accountSignals?: UserExecutionAccountSignals
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
}): boolean {
  if (!params.subAccountFlowEnabled) return false
  if (
    isParentCswEmbeddedOwnerReady({
      parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
      accountSignals: params.accountSignals,
    })
  ) {
    return false
  }
  const zoraLinked =
    params.zoraLinked ?? isZoraLinkedFromAccountSignals(params.accountSignals)
  const eoaOwners = inferWaitlistEoaOwnerRoutingHint({
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    accountSignals: params.accountSignals,
    onchainEoaOwnerCount: params.onchainEoaOwnerCount,
  })
  if (zoraLinked && eoaOwners > 0) return false
  return true
}

export function resolveEffectiveExecutionTrack(params: {
  executionTrack?: UserFrontendExecutionTrack | null
  parentEmbeddedOwnerOnChain?: boolean
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
}): UserFrontendExecutionTrack {
  if (
    params.parentEmbeddedOwnerOnChain === true ||
    params.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true ||
    params.executionTrack === 'legacy-owner-install'
  ) {
    return 'legacy-owner-install'
  }
  return params.executionTrack ?? 'none-yet'
}

export type WaitlistStepRoutingContext = {
  subAccountFlowEnabled: boolean
  embeddedEoaAvailable: boolean
  subAccountStepCompleted?: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
}

export function buildWaitlistStepRoutingParams<
  TAccount extends {
    emailVerified: boolean
    appAccessStatus: string | null
    baseSubAccount?: string | null
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
    subAccountFlowEnabled: context.subAccountFlowEnabled,
    embeddedEoaAvailable: context.embeddedEoaAvailable,
    subAccountStepCompleted: context.subAccountStepCompleted,
    parentEmbeddedOwnerOnChain: context.parentEmbeddedOwnerOnChain,
    zoraLinked,
    onchainEoaOwnerCount,
  }
}
