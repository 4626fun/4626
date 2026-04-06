export type WaitlistStep = 'auth' | 'done'

type WaitlistAccountWithCanonical = {
  accountSignals: {
    canonicalCswAddress: string | null
  }
}

type CanonicalBootstrapResult = {
  canonicalCswAddress: string | null
}

export function resolveWaitlistStep(params: {
  account: { emailVerified: boolean; appAccessStatus: string | null }
}): WaitlistStep {
  const { account } = params
  if (!account.emailVerified) return 'auth'
  // Keep waitlist onboarding one-tap: verified accounts move to completion UI.
  // Any wallet/canonical setup can continue in background or dedicated account surfaces.
  return 'done'
}

export function shouldAutoStartWaitlistAuth(params: {
  autoStartRequested?: boolean
  step: WaitlistStep
  privyAuthed: boolean
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  recoveryRequired: boolean
  error: string | null
}): boolean {
  const autoStartAllowed = params.autoStartRequested === true
  if (!autoStartAllowed) return false
  if (params.step !== 'auth') return false
  if (params.privyAuthed) return false
  if (params.privyClientStatus !== 'ready') return false
  if (params.recoveryRequired) return false
  if (params.error) return false
  return true
}

export function shouldAutoBootstrapWaitlistSession(params: {
  step: WaitlistStep
  privyAuthed: boolean
}): boolean {
  if (params.step !== 'auth') return false
  if (!params.privyAuthed) return false
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
