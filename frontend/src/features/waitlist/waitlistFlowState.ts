export type WaitlistStep = 'auth' | 'connect-base-app' | 'done'

type WaitlistAccountWithCanonical = {
  accountSignals: {
    canonicalCswAddress?: string | null
    executionTrack?: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet'
    privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
    baseSubAccount?: {
      address?: string | null
      registered?: boolean
      isDistinctFromCsw?: boolean
    }
  }
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
  if (isSubAccountExecutionReady(account.accountSignals)) return true
  return hasLegacyOwnerInstallSigning(account.accountSignals)
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
  if (params.subAccountFlowEnabled && isSubAccountExecutionReady(params.accountSignals)) {
    return true
  }
  return isLegacyParentOwnerSigningReady({
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
  })
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
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  if (!params.subAccountFlowEnabled) return false
  if (params.signingStepComplete) return false
  if (!params.embeddedEoaAvailable) return false
  if (!params.accountSignals?.canonicalCswAddress?.trim()) return false
  if (hasLegacyOwnerInstallSigning(params.accountSignals)) return false
  if (params.zoraLinked && (params.onchainEoaOwnerCount ?? 0) > 0) return false

  const subAccountAddress = resolveSubAccountAddress({
    accountSignals: params.accountSignals,
  })
  const signingReady = isWaitlistSigningReady({ accountSignals: params.accountSignals })
  const shouldOfferSubAccountStep =
    !hasRegisteredSubAccountExecution(params.accountSignals?.executionTrack)
  const shouldRecoverSubAccountOwner = Boolean(subAccountAddress) && !signingReady
  return shouldOfferSubAccountStep || shouldRecoverSubAccountOwner
}

export function resolveWaitlistStep(params: {
  account: {
    emailVerified: boolean
    appAccessStatus: string | null
    baseSubAccount?: string | null
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
  subAccountFlowEnabled?: boolean
  embeddedEoaAvailable?: boolean
  subAccountStepCompleted?: boolean
}): WaitlistStep {
  const { account, subAccountFlowEnabled, embeddedEoaAvailable, subAccountStepCompleted } = params
  if (!account.emailVerified) return 'auth'

  const track = account.accountSignals?.executionTrack
  const hasSubAccount = hasRegisteredSubAccountExecution(track)
  const signingReady =
    subAccountFlowEnabled === true
      ? isSubAccountExecutionReady(account.accountSignals)
      : isWaitlistSigningReady(account)
  const hasCanonicalCsw = Boolean(
    typeof account.accountSignals?.canonicalCswAddress === 'string' &&
      account.accountSignals.canonicalCswAddress.trim(),
  )

  if (subAccountStepCompleted === true) {
    return 'done'
  }

  const subAccountAddress = resolveSubAccountAddress({
    baseSubAccount: account.baseSubAccount ?? null,
    accountSignals: account.accountSignals,
  })

  const shouldOfferSubAccountStep =
    subAccountFlowEnabled === true && embeddedEoaAvailable === true && !hasSubAccount && hasCanonicalCsw

  const shouldRecoverSubAccountOwner =
    subAccountFlowEnabled === true &&
    embeddedEoaAvailable === true &&
    hasCanonicalCsw &&
    Boolean(subAccountAddress) &&
    !signingReady

  if (shouldOfferSubAccountStep || shouldRecoverSubAccountOwner) {
    return 'connect-base-app'
  }

  return 'done'
}

type CanonicalBootstrapResult = {
  canonicalCswAddress: string | null
}

export function shouldAutoBootstrapWaitlistSession(params: {
  step: WaitlistStep
  privyAuthed: boolean
  recoveryRequired: boolean
}): boolean {
  if (params.step !== 'auth') return false
  if (!params.privyAuthed) return false
  if (params.recoveryRequired) return false
  return true
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
