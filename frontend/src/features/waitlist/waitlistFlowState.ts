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
  return !isWaitlistSigningReady(params.account)
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
  const signingReady = isWaitlistSigningReady(account)
  const hasCanonicalCsw = Boolean(
    typeof account.accountSignals?.canonicalCswAddress === 'string' &&
      account.accountSignals.canonicalCswAddress.trim(),
  )

  // Session-local completion: stay on done while bootstrap catches up.
  if (subAccountStepCompleted === true) {
    return 'done'
  }

  const subAccountAddress = resolveSubAccountAddress({
    baseSubAccount: account.baseSubAccount ?? null,
    accountSignals: account.accountSignals,
  })

  const shouldOfferSubAccountStep =
    subAccountFlowEnabled === true &&
    embeddedEoaAvailable === true &&
    !hasSubAccount &&
    hasCanonicalCsw

  const shouldRecoverSubAccountOwner =
    subAccountFlowEnabled === true &&
    embeddedEoaAvailable === true &&
    hasCanonicalCsw &&
    Boolean(subAccountAddress) &&
    !signingReady

  // Base App path: provision a new sub-account or finish owner install on an existing one.
  if (shouldOfferSubAccountStep || shouldRecoverSubAccountOwner) {
    return 'connect-base-app'
  }

  // Verified email — wallet setup lives on the done workspace, not the auth gate.
  if (!signingReady) return 'done'

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
