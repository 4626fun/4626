export type WaitlistEmailUi = {
  title: string
  subtitle: string
  ctaLabel: string
  busyLabel: string
}

export function canEnterAppFromAccountState(params: { appAccessStatus: string | null }): boolean {
  const status = String(params.appAccessStatus ?? '').trim().toLowerCase()
  return status === 'approved'
}

export function deriveWaitlistAuthUi(options?: { recoveryRequired?: boolean }): WaitlistEmailUi {
  if (options?.recoveryRequired) {
    return {
      title: 'Welcome back',
      subtitle: 'This email already has a 4626 account. Sign in to join the waitlist with it.',
      ctaLabel: 'Use existing account',
      busyLabel: 'Signing in to your existing account…',
    }
  }

  return {
    title: 'Waitlist',
    subtitle: 'Sign in with email to save your spot.',
    ctaLabel: 'Continue',
    busyLabel: 'Setting up your account…',
  }
}
