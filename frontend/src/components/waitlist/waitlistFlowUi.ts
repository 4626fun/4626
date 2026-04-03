import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'

export type WaitlistEmailUi = {
  title: string
  subtitle: string
  ctaLabel: string
  busyLabel: string
}

export type WaitlistDoneUi = {
  title: string
  subtitle: string
  primaryLabel: string
  secondaryLabel: string | null
}

export function canEnterAppFromAccountState(params: { appAccessStatus: string | null }): boolean {
  const status = String(params.appAccessStatus ?? '').trim().toLowerCase()
  return status === 'approved'
}

/** Copy for the waitlist sign-in step (email is collected only in the Privy modal). */
export function deriveWaitlistAuthUi(): WaitlistEmailUi {
  return {
    title: 'Get early access',
    subtitle:
      'Verify your email to lock your spot and unlock your referral link.',
    ctaLabel: 'Join waitlist',
    busyLabel: 'Opening email sign-in…',
  }
}

export function deriveWaitlistDoneUi(canEnterApp: boolean): WaitlistDoneUi {
  if (canEnterApp) {
    return {
      title: "You're in!",
      subtitle: 'Your account is ready. Enter the app now, or visit accounts to manage connected identities and points.',
      primaryLabel: `${SHARE_SYMBOL_PREFIX} Enter App`,
      secondaryLabel: 'Go to accounts',
    }
  }

  return {
    title: "You're in!",
    subtitle: 'Visit accounts to manage connected identities, earn points, and wait for admin approval.',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Go to accounts`,
    secondaryLabel: null,
  }
}
