import type { UserExecutionAccountSignals } from '@/lib/wallet/userExecutionTrack'

export type WaitlistStep = 'auth' | 'done'

/**
 * Minimal input shape accepted by pure decision helpers (resolveWaitlistStep, etc.).
 */
export type WaitlistStepAccountInput = {
  emailVerified: boolean
  [key: string]: unknown
}

type WaitlistAccountWithCanonical = {
  accountSignals: UserExecutionAccountSignals
}

/** Parent-CSW legacy owner install — requires on-chain confirmation, not server/db flags alone. */
function isLegacyParentOwnerSigningReady(params: {
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  return params.parentEmbeddedOwnerOnChain === true
}

export function shouldFocusBaseAppWalletSetup(params: {
  inBaseApp: boolean
  signingStepComplete: boolean
  baseWalletReady: boolean
  account: {
    emailVerified: boolean
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
}): boolean {
  if (!params.inBaseApp) return false
  if (!params.account.emailVerified) return false
  if (params.signingStepComplete) return false
  return !params.baseWalletReady
}

export function resolveWaitlistAccordionOpenStep(params: {
  manualOpenStep: 1 | 2 | null
  ownerInstallRequested: boolean
  stepOneComplete: boolean
  focusBaseAppWalletSetup: boolean
}): 1 | 2 {
  if (params.manualOpenStep === 1 || params.manualOpenStep === 2) return params.manualOpenStep
  if (params.focusBaseAppWalletSetup) return 2
  if (params.ownerInstallRequested) return 2
  return params.stepOneComplete ? 2 : 1
}

/**
 * Waitlist step 2 completion — parent CSW embedded owner on-chain.
 */
export function isWaitlistStepTwoSigningComplete(params: {
  ownerInstallRequested: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  if (params.parentEmbeddedOwnerOnChain === true) return true
  if (params.accountSignals?.executionTrack === 'legacy-owner-install') return true
  return false
}

export function shouldShowParentCswAddOwnerPanel(params: {
  inBaseApp?: boolean
  zoraLinked?: boolean
  ownerInstallRequested: boolean
  signingStepComplete: boolean
  executionTrack?: WaitlistAccountWithCanonical['accountSignals']['executionTrack']
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
  onchainEoaOwnerCount?: number
  baseWalletReady?: boolean
}): boolean {
  if (params.signingStepComplete) return false
  if (isLegacyParentOwnerSigningReady({ parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain })) {
    return false
  }
  const canonical =
    typeof params.accountSignals?.canonicalCswAddress === 'string'
      ? params.accountSignals.canonicalCswAddress.trim()
      : ''
  if (!canonical) return false
  if (params.accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) return false

  if (params.inBaseApp) {
    return params.baseWalletReady !== false
  }

  if ((params.onchainEoaOwnerCount ?? 0) <= 0) return false
  if (!params.zoraLinked && !params.ownerInstallRequested) return false
  return true
}

/** Base App: link the parent CSW via Privy base_account connector before owner install. */
export function shouldShowBaseAppWalletLinkPanel(params: {
  inBaseApp: boolean
  signingStepComplete: boolean
  embeddedEoaAvailable: boolean
  baseWalletReady: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  if (!params.inBaseApp) return false
  if (params.signingStepComplete) return false
  if (!params.embeddedEoaAvailable) return false
  if (params.baseWalletReady) return false
  return Boolean(params.accountSignals?.canonicalCswAddress?.trim())
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
