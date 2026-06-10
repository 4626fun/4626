import { shouldUseBaseAppSubAccountPath, type UserExecutionAccountSignals } from '@/lib/wallet/userExecutionTrack'

export type WaitlistStep = 'auth' | 'done'

/**
 * Minimal input shape accepted by pure decision helpers (resolveWaitlistStep, etc.).
 *
 * Callers on the bootstrap success path always receive the full AccountSetupMe
 * (via WaitlistAccountsSummary = AccountSetupMe). We explicitly allow extra
 * properties so tests and real richer objects (emailVerified + appAccessStatus +
 * accountSignals + privyUserId + score, etc.) do not trigger TS excess-property
 * errors when passed to these narrow decision functions.
 */
export type WaitlistStepAccountInput = {
  emailVerified: boolean
  [key: string]: unknown
}

type WaitlistAccountWithCanonical = {
  accountSignals: UserExecutionAccountSignals
}

function hasRegisteredSubAccountExecution(
  track: WaitlistAccountWithCanonical['accountSignals']['executionTrack'] | undefined,
): boolean {
  return track === 'sub-account' || track === 'migration-pending'
}

/** Parent-CSW legacy owner install — requires on-chain confirmation, not server/db flags alone. */
function isLegacyParentOwnerSigningReady(params: {
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  return params.parentEmbeddedOwnerOnChain === true
}

function isSubAccountExecutionReady(
  accountSignals?: WaitlistAccountWithCanonical['accountSignals'],
): boolean {
  if (accountSignals?.baseSubAccount?.registered === true) return true
  return hasRegisteredSubAccountExecution(accountSignals?.executionTrack)
}

function resolveSubAccountAddress(params: {
  baseSubAccount?: string | null
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): string | null {
  const fromSignals = params.accountSignals?.baseSubAccount?.address?.trim()
  if (fromSignals) return fromSignals
  const fromProfile = params.baseSubAccount?.trim()
  return fromProfile || null
}

export function shouldFocusWaitlistBaseAppConnect(params: {
  inBaseApp: boolean
  showBaseAppConnectPanel: boolean
  signingStepComplete: boolean
  setupIntent?: string | null
  subAccountFlowEnabled?: boolean
  parentEmbeddedOwnerOnChain?: boolean
  zoraLinked?: boolean
  onchainEoaOwnerCount?: number
  account: {
    emailVerified: boolean
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
}): boolean {
  if (params.signingStepComplete) return false
  if (params.inBaseApp && params.showBaseAppConnectPanel) return true
  return shouldForceBaseAppConnectStep({
    setupIntent: params.setupIntent,
    subAccountFlowEnabled: params.subAccountFlowEnabled,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    zoraLinked: params.zoraLinked,
    onchainEoaOwnerCount: params.onchainEoaOwnerCount,
    account: params.account,
  })
}

export function resolveWaitlistAccordionOpenStep(params: {
  manualOpenStep: 1 | 2 | null
  ownerInstallRequested: boolean
  stepOneComplete: boolean
  focusBaseAppConnect: boolean
}): 1 | 2 {
  if (params.manualOpenStep === 1 || params.manualOpenStep === 2) return params.manualOpenStep
  if (params.focusBaseAppConnect) return 2
  if (params.ownerInstallRequested) return 2
  return params.stepOneComplete ? 2 : 1
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
  account: WaitlistStepAccountInput
}): WaitlistStep {
  if (!params.account.emailVerified) return 'auth'
  return 'done'
}

type CanonicalBootstrapResult = {
  canonicalCswAddress: string | null
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
