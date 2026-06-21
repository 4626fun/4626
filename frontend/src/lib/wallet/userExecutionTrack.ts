/**
 * Client-side user-initiated frontend execution track resolution.
 *
 * Parent CSW embedded-owner (population c) must win over stale sub-account DB
 * state (population b). Shared by waitlist, swap, and deploy surfaces.
 */

export type UserFrontendExecutionTrack =
  | 'sub-account'
  | 'legacy-owner-install'
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

export type AccountChromeExecutionMode = 'parent-csw' | 'sub-account' | 'none'

export type AccountChromeExecution = {
  mode: AccountChromeExecutionMode
  effectiveExecutionTrack: UserFrontendExecutionTrack
  showSubAccountInTray: boolean
  showSubAccountInAccounts: boolean
  swapSenderLabel: string | null
  subAccountAddress: string | null
  executionLaneTitle: string
  executionLaneDescription: string
}

function resolveDistinctSubAccountAddress(params: {
  effectiveExecutionTrack: UserFrontendExecutionTrack
  canonicalCswAddress?: string | null
  baseSubAccount?: {
    address?: string | null
    registered?: boolean
    isDistinctFromCsw?: boolean
  } | null
}): string | null {
  if (params.effectiveExecutionTrack !== 'sub-account') {
    return null
  }
  const candidate = params.baseSubAccount?.address
  if (params.baseSubAccount?.registered !== true || typeof candidate !== 'string' || !candidate.trim()) {
    return null
  }
  const normalized = candidate.trim()
  if (params.baseSubAccount.isDistinctFromCsw === false) return null
  if (
    params.canonicalCswAddress &&
    normalized.toLowerCase() === params.canonicalCswAddress.toLowerCase()
  ) {
    return null
  }
  return normalized
}

/**
 * Account chrome (tray, /accounts, swap sender hint) must follow the effective
 * execution track — parent CSW owner (population c) hides stale sub-account UI.
 */
export function deriveAccountChromeExecution(params: {
  executionTrack?: UserFrontendExecutionTrack | null
  parentEmbeddedOwnerOnChain?: boolean
  privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
  subAccountFlowEnabled?: boolean
  canonicalCswAddress?: string | null
  baseSubAccount?: {
    address?: string | null
    registered?: boolean
    isDistinctFromCsw?: boolean
  } | null
}): AccountChromeExecution {
  const effectiveExecutionTrack = resolveEffectiveExecutionTrack({
    executionTrack: params.executionTrack,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: params.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
  })

  const subAccountAddress = resolveDistinctSubAccountAddress({
    effectiveExecutionTrack,
    canonicalCswAddress: params.canonicalCswAddress,
    baseSubAccount: params.baseSubAccount,
  })

  const subAccountLaneActive =
    params.subAccountFlowEnabled === true &&
    Boolean(subAccountAddress) &&
    (effectiveExecutionTrack === 'sub-account')

  if (effectiveExecutionTrack === 'legacy-owner-install') {
    return {
      mode: 'parent-csw',
      effectiveExecutionTrack,
      showSubAccountInTray: false,
      showSubAccountInAccounts: false,
      swapSenderLabel: 'Sending from your Coinbase Smart Wallet',
      subAccountAddress: null,
      executionLaneTitle: 'Parent smart wallet signing',
      executionLaneDescription:
        'Sponsored swaps and deploys send from your Coinbase Smart Wallet — your canonical identity.',
    }
  }

  if (subAccountLaneActive) {
    return {
      mode: 'sub-account',
      effectiveExecutionTrack,
      showSubAccountInTray: true,
      showSubAccountInAccounts: true,
      swapSenderLabel: 'Sending from 4626 app wallet (swaps only)',
      subAccountAddress,
      executionLaneTitle: '4626 app wallet (swaps only)',
      executionLaneDescription:
        'Base App swap lane — execution only, not your onchain identity or deploy sender.',
    }
  }

  return {
    mode: 'none',
    effectiveExecutionTrack,
    showSubAccountInTray: false,
    showSubAccountInAccounts: false,
    swapSenderLabel: null,
    subAccountAddress: null,
    executionLaneTitle: 'Execution lane',
    executionLaneDescription: 'Finish account setup to enable sponsored swaps.',
  }
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
