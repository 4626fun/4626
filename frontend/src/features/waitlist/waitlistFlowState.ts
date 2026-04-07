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
