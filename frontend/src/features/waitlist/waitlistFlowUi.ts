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

export function deriveWaitlistAuthUi(): WaitlistEmailUi {
  return {
    title: 'Waitlist',
    subtitle: 'Secure sign-in to save your spot.',
    ctaLabel: 'Continue',
    busyLabel: 'Preparing your account...',
  }
}
