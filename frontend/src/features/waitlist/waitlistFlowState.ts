export type WaitlistStep = 'auth' | 'connect-base-app' | 'done'

type WaitlistAccountWithCanonical = {
  accountSignals: {
    canonicalCswAddress?: string | null
    executionTrack?: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet'
    privyEmbeddedEoaIsOwnerOfCanonicalCsw?: boolean | null
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

export function isWaitlistSigningReady(account: {
  accountSignals?: WaitlistAccountWithCanonical['accountSignals']
}): boolean {
  const track = account.accountSignals?.executionTrack
  return hasLegacyOwnerInstallSigning(account.accountSignals) || hasRegisteredSubAccountExecution(track)
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
export function resolveWaitlistStep(params: {
  account: {
    emailVerified: boolean
    appAccessStatus: string | null
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
  const signingReady = isWaitlistSigningReady(account)
  const hasCanonicalCsw = Boolean(
    typeof account.accountSignals?.canonicalCswAddress === 'string' &&
      account.accountSignals.canonicalCswAddress.trim(),
  )

  // Session-local completion: stay on done while bootstrap catches up.
  if (subAccountStepCompleted === true) {
    return 'done'
  }

  const shouldOfferSubAccountStep =
    subAccountFlowEnabled === true &&
    embeddedEoaAvailable === true &&
    subAccountStepCompleted !== true &&
    !hasSubAccount &&
    hasCanonicalCsw

  // Base App path: sub-account setup does not require legacy owner install first.
  if (shouldOfferSubAccountStep) {
    return 'connect-base-app'
  }

  if (!signingReady) return 'auth'

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
