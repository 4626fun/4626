import {
  buildWaitlistStepRoutingParams,
  inferWaitlistEoaOwnerRoutingHint,
  isParentCswEmbeddedOwnerReady,
  isZoraLinkedFromAccountSignals,
  resolveEffectiveExecutionTrack,
  shouldUseBaseAppSubAccountPath,
  type UserExecutionAccountSignals,
  type WaitlistStepRoutingContext,
} from '@/lib/wallet/userExecutionTrack'

export type WaitlistStep = 'auth' | 'connect-base-app' | 'done'

export {
  buildWaitlistStepRoutingParams,
  inferWaitlistEoaOwnerRoutingHint,
  isParentCswEmbeddedOwnerReady,
  isZoraLinkedFromAccountSignals,
  resolveEffectiveExecutionTrack,
  shouldUseBaseAppSubAccountPath,
  type WaitlistStepRoutingContext,
}

type WaitlistAccountWithCanonical = {
  accountSignals: UserExecutionAccountSignals
}

function hasRegisteredSubAccountExecution(
  track: WaitlistAccountWithCanonical['accountSignals']['executionTrack'] | undefined,
): boolean {
  return track === 'sub-account' || track === 'migration-pending'
}

function hasLegacyOwnerInstallSigning(
  accountSignals: WaitlistAccountWithCanonical['accountSignals'] | undefined,
): boolean {
  return (
    accountSignals?.executionTrack === 'legacy-owner-install' ||
    accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true
  )
}

/** Parent-CSW legacy owner install — requires on-chain confirmation, not server/db flags alone. */
function isLegacyParentOwnerSigningReady(params: {
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  return params.parentEmbeddedOwnerOnChain === true
}

export function isSubAccountExecutionReady(
  accountSignals?: WaitlistAccountWithCanonical['accountSignals'],
): boolean {
  if (accountSignals?.baseSubAccount?.registered === true) return true
  return hasRegisteredSubAccountExecution(accountSignals?.executionTrack)
}

export function resolveSubAccountAddress(params: {
  baseSubAccount?: string | null
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): string | null {
  const fromSignals = params.accountSignals?.baseSubAccount?.address?.trim()
  if (fromSignals) return fromSignals
  const fromProfile = params.baseSubAccount?.trim()
  return fromProfile || null
}

export function shouldPromptBaseAccountReconnect(params: {
  subAccountFlowEnabled: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  if (!params.subAccountFlowEnabled) return false
  const signals = params.accountSignals
  if (!signals?.canonicalCswAddress?.trim()) return false
  if (isSubAccountExecutionReady(signals)) return false
  if (signals.executionTrack === 'legacy-owner-install') return false
  if (signals.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) return false
  return signals.executionTrack === 'none-yet'
}

export function isWaitlistSigningReady(account: {
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  if (hasLegacyOwnerInstallSigning(account.accountSignals)) return true
  if (isSubAccountExecutionReady(account.accountSignals)) return true
  return false
}

const SIGNING_ENABLED_NOTICE_RE = /4626 signing is enabled|already enabled/i

/** Server signals plus optimistic UI when a success notice landed before `me` refreshes. */
export function isWaitlistSigningReadyForUi(
  account: Parameters<typeof isWaitlistSigningReady>[0],
  notice?: string | null,
): boolean {
  return isWaitlistSigningReady(account) || SIGNING_ENABLED_NOTICE_RE.test(notice ?? '')
}

export type WaitlistSubAccountConnectOverlay = {
  parentAddress: string
  subAccountAddress: string
}

/** Keep waitlist UI signing-ready while bootstrap catches up after Base App connect. */
export function applyWaitlistSubAccountConnectOverlay<T extends WaitlistAccountWithCanonical>(
  account: T,
  overlay: WaitlistSubAccountConnectOverlay | null | undefined,
  subAccountStepCompleted: boolean,
): T {
  if (!overlay || !subAccountStepCompleted) return account
  if (isParentCswEmbeddedOwnerReady({ accountSignals: account.accountSignals })) return account
  if (isWaitlistSigningReady(account)) return account

  const canonical =
    (typeof account.accountSignals.canonicalCswAddress === 'string' &&
    account.accountSignals.canonicalCswAddress.trim()
      ? account.accountSignals.canonicalCswAddress.trim()
      : null) ?? overlay.parentAddress

  return {
    ...account,
    ...('baseSubAccount' in account ? { baseSubAccount: overlay.subAccountAddress } : {}),
    accountSignals: {
      ...account.accountSignals,
      canonicalCswAddress: canonical,
      executionTrack: 'sub-account',
      baseSubAccount: {
        address: overlay.subAccountAddress,
        isDistinctFromCsw: true,
        registered: true,
      },
    },
  } as T
}

export function shouldForceBaseAppConnectStep(params: {
  setupIntent: string | null | undefined
  subAccountFlowEnabled?: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
  account: {
    emailVerified: boolean
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
}): boolean {
  const setup = String(params.setupIntent ?? '')
    .trim()
    .toLowerCase()
  if (setup !== 'base-app') return false
  if (params.subAccountFlowEnabled !== true) return false
  if (!params.account.emailVerified) return false
  if (
    !shouldUseBaseAppSubAccountPath({
      subAccountFlowEnabled: params.subAccountFlowEnabled === true,
      parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
      accountSignals: params.account.accountSignals,
      zoraLinked: params.zoraLinked,
      onchainEoaOwnerCount: params.onchainEoaOwnerCount,
    })
  ) {
    return false
  }
  return !isSubAccountExecutionReady(params.account.accountSignals)
}

/**
 * Waitlist step 2 completion — parent CSW embedded owner on-chain or sub-account track.
 */
export function isWaitlistStepTwoSigningComplete(params: {
  ownerInstallRequested: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
  subAccountFlowEnabled?: boolean
}): boolean {
  if (params.parentEmbeddedOwnerOnChain === true) return true
  if (params.accountSignals?.executionTrack === 'legacy-owner-install') return true
  if (params.subAccountFlowEnabled && isSubAccountExecutionReady(params.accountSignals)) {
    return true
  }
  return false
}

export function shouldShowParentCswAddOwnerPanel(params: {
  zoraLinked?: boolean
  ownerInstallRequested: boolean
  signingStepComplete: boolean
  executionTrack?: WaitlistAccountWithCanonical['accountSignals']['executionTrack']
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
  onchainEoaOwnerCount?: number
  subAccountFlowEnabled?: boolean
}): boolean {
  if (params.subAccountFlowEnabled && isSubAccountExecutionReady(params.accountSignals)) return false
  if (params.signingStepComplete) return false
  if (isLegacyParentOwnerSigningReady({ parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain })) {
    return false
  }
  const canonical =
    typeof params.accountSignals?.canonicalCswAddress === 'string'
      ? params.accountSignals.canonicalCswAddress.trim()
      : ''
  if (!canonical) return false
  if ((params.onchainEoaOwnerCount ?? 0) <= 0) return false
  if (params.accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) return false
  if (!params.zoraLinked && !params.ownerInstallRequested) return false
  return true
}

export function shouldShowBaseAppConnectPanel(params: {
  subAccountFlowEnabled: boolean
  signingStepComplete: boolean
  embeddedEoaAvailable: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  if (!params.subAccountFlowEnabled) return false
  if (params.signingStepComplete) return false
  if (!params.embeddedEoaAvailable) return false
  if (!params.accountSignals?.canonicalCswAddress?.trim()) return false
  if (
    !shouldUseBaseAppSubAccountPath({
      subAccountFlowEnabled: params.subAccountFlowEnabled,
      parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
      accountSignals: params.accountSignals,
      zoraLinked: params.zoraLinked,
      onchainEoaOwnerCount: params.onchainEoaOwnerCount,
    })
  ) {
    return false
  }

  const subAccountAddress = resolveSubAccountAddress({
    accountSignals: params.accountSignals,
  })
  const signingReady = isWaitlistStepTwoSigningComplete({
    accountSignals: params.accountSignals,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    subAccountFlowEnabled: params.subAccountFlowEnabled,
    ownerInstallRequested: false,
  })
  const shouldOfferSubAccountStep =
    !hasRegisteredSubAccountExecution(params.accountSignals?.executionTrack)
  const shouldRecoverSubAccountOwner = Boolean(subAccountAddress) && !signingReady
  return shouldOfferSubAccountStep || shouldRecoverSubAccountOwner
}

export function resolveWaitlistStep(params: {
  account: {
    emailVerified: boolean
    appAccessStatus?: string | null
    baseSubAccount?: string | null
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
  /** Unused — kept for call-site stability while routing stays auth → done only. */
  subAccountFlowEnabled?: boolean
  embeddedEoaAvailable?: boolean
  subAccountStepCompleted?: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
}): WaitlistStep {
  if (!params.account.emailVerified) return 'auth'
  return 'done'
}

type CanonicalBootstrapResult = {
  canonicalCswAddress: string | null
}

export function shouldAutoBootstrapWaitlistSession(_params: {
  step: WaitlistStep
  privyAuthed: boolean
  recoveryRequired: boolean
}): boolean {
  return false
}

export function mergeCanonicalWaitlistAccount<T extends WaitlistAccountWithCanonical>(
  account: T,
  canonicalBootstrap: CanonicalBootstrapResult | null | undefined,
): T {
  const bootstrappedCanonical =
    canonicalBootstrap && typeof canonicalBootstrap.canonicalCswAddress === 'string'
      ? canonicalBootstrap.canonicalCswAddress.trim()
      : ''
  if (!bootstrappedCanonical) return account

  const existingCanonical =
    typeof account.accountSignals.canonicalCswAddress === 'string'
      ? account.accountSignals.canonicalCswAddress.trim()
      : ''
  if (existingCanonical.toLowerCase() === bootstrappedCanonical.toLowerCase()) return account

  return {
    ...account,
    accountSignals: {
      ...account.accountSignals,
      canonicalCswAddress: bootstrappedCanonical,
    },
  }
}
