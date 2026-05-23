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

export function isWaitlistSubAccountLinkReady(account: {
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  return hasLegacyOwnerInstallSigning(account.accountSignals)
}

/** Parent-CSW legacy owner install — requires on-chain confirmation, not server/db flags alone. */
function isLegacyParentOwnerSigningReady(params: {
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  return params.parentEmbeddedOwnerOnChain === true
}

/**
 * Waitlist step 2 completion — parent CSW embedded owner on-chain.
 */
export function isWaitlistStepTwoSigningComplete(params: {
  ownerInstallRequested: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
  subAccountEmbeddedOwnerOnChain?: boolean
}): boolean {
  return isLegacyParentOwnerSigningReady({
    accountSignals: params.accountSignals,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
  })
}

export function shouldShowParentCswAddOwnerPanel(params: {
  ownerInstallRequested: boolean
  signingStepComplete: boolean
  executionTrack?: WaitlistAccountWithCanonical['accountSignals']['executionTrack']
  preferBaseAppSubAccountSetup: boolean
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  parentEmbeddedOwnerOnChain?: boolean
}): boolean {
  if (params.signingStepComplete) return false
  return !isLegacyParentOwnerSigningReady({
    accountSignals: params.accountSignals,
    parentEmbeddedOwnerOnChain: params.parentEmbeddedOwnerOnChain,
  })
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
  if (isWaitlistSubAccountLinkReady(account)) return account

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

type CanonicalBootstrapResult = {
  canonicalCswAddress: string | null
}

/**
 * Resolve the next waitlist step from the current account snapshot.
 *
 * Track C2 — when `subAccountFlowEnabled` is true and the bootstrap
 * surfaced a Privy embedded EOA plus a canonical CSW, verified-email
 * accounts route through the optional `connect-base-app` step. Base App
 * users can complete sub-account provisioning without legacy
 * `addOwnerAddress` on the parent CSW. With the flag off, behaviour
 * matches the prior `auth → done` shape for legacy owner-install only.
 */
/**
 * When `/waitlist?setup=base-app` is present and signing is still incomplete,
 * reopen the connect step even if the user previously tapped "Skip for now".
 * Swap and account-setup surfaces deep-link here so users can finish later.
 */
export function shouldForceBaseAppConnectStep(_params: {
  setupIntent: string | null | undefined
  subAccountFlowEnabled?: boolean
  account: {
    emailVerified: boolean
    accountSignals?: WaitlistAccountWithCanonical['accountSignals']
  }
  signingStepComplete?: boolean
  signingProbePending?: boolean
}): boolean {
  return false
}

/**
 * `/waitlist?setup=owner-install` opens the legacy parent-CSW owner-install workspace
 * on desktop (Rabby/MetaMask/Base Account), bypassing the Base App sub-account step.
 */
export function shouldForceOwnerInstallSetupStep(params: {
  setupIntent: string | null | undefined
  subAccountFlowEnabled?: boolean
  account: { emailVerified: boolean }
}): boolean {
  const setup = String(params.setupIntent ?? '')
    .trim()
    .toLowerCase()
  if (setup !== 'owner-install') return false
  if (params.subAccountFlowEnabled !== true) return false
  return params.account.emailVerified
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
  setupIntent?: string | null
}): WaitlistStep {
  const { account, subAccountFlowEnabled, subAccountStepCompleted, setupIntent } = params
  if (!account.emailVerified) return 'auth'

  if (
    shouldForceOwnerInstallSetupStep({
      setupIntent,
      subAccountFlowEnabled,
      account,
    })
  ) {
    return 'done'
  }

  // Session-local completion: stay on done while bootstrap catches up.
  if (subAccountStepCompleted === true) {
    return 'done'
  }

  // Verified email — parent CSW owner install lives on the done workspace.
  return 'done'
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
    typeof account.accountSignals.canonicalCswAddress === 'string' ? account.accountSignals.canonicalCswAddress.trim() : ''
  if (existingCanonical.toLowerCase() === bootstrappedCanonical.toLowerCase()) return account

  return {
    ...account,
    accountSignals: {
      ...account.accountSignals,
      canonicalCswAddress: bootstrappedCanonical,
    },
  }
}
