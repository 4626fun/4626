import type { InputOTPStatus } from '@/components/ui/InputOTP'
import {
  isZoraLinkedFromAccountSignals,
  type UserExecutionAccountSignals,
  type UserFrontendExecutionTrack,
} from '@/lib/wallet/userExecutionTrack'

export type WaitlistStep = 'auth' | 'done'

/** Waitlist messaging / signing fork — server population first, not in-app browser alone. */
export type WaitlistConnectTrack =
  | 'base-app-direct'
  | 'zora-owner-install'
  | 'privy-owner-install'
  | 'not-ready'

/**
 * Minimal input shape accepted by pure decision helpers (resolveWaitlistStep, etc.).
 */
export type WaitlistStepAccountInput = {
  emailVerified: boolean
  [key: string]: unknown
}

/**
 * Resolve app admission from the cookie-authenticated waitlist profile first.
 *
 * `/api/accounts/me` needs a live Privy token and may be unavailable while the
 * already-established 4626 session remains valid. A concrete session status is
 * authoritative; the richer account payload is only a fallback while that
 * cookie-backed read has not settled.
 */
export function resolveWaitlistAppAccepted(params: {
  sessionAppAccessStatus?: string | null
  accountAppAccessStatus?: string | null
}): boolean {
  const status =
    params.sessionAppAccessStatus !== undefined
      ? params.sessionAppAccessStatus
      : params.accountAppAccessStatus
  return String(status ?? '').trim().toLowerCase() === 'approved'
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
  connectTrack?: WaitlistConnectTrack
  signingStepComplete: boolean
  baseWalletReady: boolean
  account: {
    emailVerified: boolean
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
}): boolean {
  if (!params.inBaseApp) return false
  if (params.connectTrack === 'zora-owner-install') return false
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

export function resolveWaitlistConnectTrack(params: {
  executionTrack?: UserFrontendExecutionTrack | null
  accountSignals?: UserExecutionAccountSignals
  zoraLinked?: boolean
  canonicalCswAddress?: string | null
  embeddedEoaAvailable?: boolean
}): WaitlistConnectTrack {
  const executionTrack = params.executionTrack ?? params.accountSignals?.executionTrack ?? null
  const zoraLinked =
    params.zoraLinked ?? isZoraLinkedFromAccountSignals(params.accountSignals)
  const canonicalSource = params.accountSignals?.canonicalSource?.trim().toLowerCase() ?? ''
  if (executionTrack === 'base-app-direct' && canonicalSource === 'base_account') {
    return 'base-app-direct'
  }
  if (executionTrack === 'legacy-owner-install') return 'zora-owner-install'

  const canonical =
    typeof params.canonicalCswAddress === 'string'
      ? params.canonicalCswAddress.trim()
      : typeof params.accountSignals?.canonicalCswAddress === 'string'
        ? params.accountSignals.canonicalCswAddress.trim()
        : ''
  const embeddedReady =
    params.embeddedEoaAvailable === true ||
    Boolean(params.accountSignals?.embeddedEoaAddress?.trim())

  if (zoraLinked && canonical && embeddedReady) return 'zora-owner-install'
  if (canonicalSource === 'base_account' && canonical && embeddedReady) {
    return 'base-app-direct'
  }
  if (params.accountSignals?.canonicalSource === 'privy_csw' && canonical && embeddedReady) {
    return 'privy-owner-install'
  }
  if (canonical && embeddedReady && !zoraLinked) return 'privy-owner-install'
  return 'not-ready'
}

/**
 * Whether the waitlist messaging connect/join surface may open for this account.
 * Base App population skips embedded-owner install; Zora requires it first.
 */
export function isWaitlistMessagingSigningReady(params: {
  connectTrack?: WaitlistConnectTrack
  executionTrack?: UserFrontendExecutionTrack | null
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
  ownerInstallRequested?: boolean
}): boolean {
  const connectTrack =
    params.connectTrack ??
    resolveWaitlistConnectTrack({
      executionTrack: params.executionTrack ?? params.accountSignals?.executionTrack,
      accountSignals: params.accountSignals,
    })

  if (connectTrack === 'base-app-direct') return true
  if (connectTrack === 'zora-owner-install' || connectTrack === 'privy-owner-install') {
    return isWaitlistStepTwoSigningComplete({
      ownerInstallRequested: params.ownerInstallRequested ?? false,
      accountSignals: params.accountSignals,
      parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
    })
  }
  return false
}

/**
 * Waitlist step 2 completion — parent CSW embedded owner on-chain (Zora track).
 * Base App direct population is messaging-ready without this step.
 */
export function isWaitlistStepTwoSigningComplete(params: {
  ownerInstallRequested: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  if (params.parentEmbeddedOwnerOnChain === true) return true
  return false
}

export function shouldShowParentCswAddOwnerPanel(params: {
  inBaseApp?: boolean
  zoraLinked?: boolean
  connectTrack?: WaitlistConnectTrack
  ownerInstallRequested: boolean
  signingStepComplete: boolean
  embeddedEoaAvailable?: boolean
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
  const embeddedReady =
    params.embeddedEoaAvailable === true ||
    Boolean(params.accountSignals?.embeddedEoaAddress?.trim())
  if (!embeddedReady) return false
  if (params.accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) return false

  if (params.inBaseApp) {
    return params.baseWalletReady === true
  }

  if (params.connectTrack === 'base-app-direct') return true
  if (params.connectTrack === 'privy-owner-install') return true

  if (params.connectTrack === 'zora-owner-install') {
    if ((params.onchainEoaOwnerCount ?? 0) <= 0 && !params.zoraLinked) return false
    if (!params.zoraLinked && !params.ownerInstallRequested) return false
    return true
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

/**
 * Decides whether the 6-digit email OTP should auto-submit. `lastAttemptedCode`
 * must be set (and never cleared) once a code has been attempted — regardless
 * of whether that attempt succeeded or failed — so a failed verification
 * (wrong code, network error, provider rate limit, ...) does not immediately
 * re-arm this effect and auto-resubmit the exact same unchanged code in a
 * tight retry loop. The user can still retry explicitly via the submit
 * button, which calls the verify handler directly and does not consult this
 * guard; auto-submit only fires again once the code itself changes.
 */
export function shouldAutoSubmitOtpCode(params: {
  step: 'email' | 'code'
  normalizedCode: string
  codeBusy: boolean
  lastAttemptedCode: string | null
}): boolean {
  if (params.step !== 'code') return false
  if (params.codeBusy) return false
  if (params.normalizedCode.length !== 6) return false
  return params.lastAttemptedCode !== params.normalizedCode
}

/** Post-OTP submit button phases — setup must win over static "Verified" while bootstrap runs. */
export type WaitlistOtpSubmitPhase = 'idle' | 'verifying' | 'setting_up' | 'verified'

/**
 * Resolves waitlist OTP submit UI phase. While OTP is accepted and join/bootstrap
 * is still in flight (`success` + `codeBusy`), prefer `setting_up` so the button
 * does not look finished during session bridge work.
 */
export function resolveWaitlistOtpSubmitPhase(params: {
  codeStatus: InputOTPStatus
  codeBusy: boolean
}): WaitlistOtpSubmitPhase {
  if (params.codeBusy && params.codeStatus === 'success') return 'setting_up'
  if (params.codeBusy) return 'verifying'
  if (params.codeStatus === 'success') return 'verified'
  return 'idle'
}

export function getWaitlistOtpSubmitLabel(phase: WaitlistOtpSubmitPhase): string {
  switch (phase) {
    case 'setting_up':
      return 'Setting up your account…'
    case 'verifying':
      return 'Verifying…'
    case 'verified':
      return 'Verified'
    case 'idle':
      return 'Verify & join'
    default: {
      const _exhaustive: never = phase
      return _exhaustive
    }
  }
}

/** Reassurance under the OTP submit button during the post-verify bootstrap gap. */
export function getWaitlistOtpSubmitHelperText(phase: WaitlistOtpSubmitPhase): string | null {
  if (phase === 'setting_up') return 'This usually takes a few seconds.'
  return null
}

/**
 * Visual status for the OTP digit cells. Mirrors `resolveWaitlistOtpSubmitPhase`'s
 * "don't celebrate until actually done" rule: the cells only turn green once the
 * account is fully set up (`verified`), not merely once the code was accepted while
 * setup is still running. Error styling still surfaces immediately.
 */
export function resolveWaitlistOtpInputStatus(params: {
  codeStatus: InputOTPStatus
  codeBusy: boolean
}): InputOTPStatus {
  if (params.codeStatus === 'error') return 'error'
  const phase = resolveWaitlistOtpSubmitPhase(params)
  return phase === 'verified' ? 'success' : 'default'
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
