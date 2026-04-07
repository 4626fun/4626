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

export function deriveWaitlistAuthUi(): WaitlistEmailUi {
  return {
    title: 'Get early access',
    subtitle: 'Use one quick sign-in to save your spot. We handle account setup in the background.',
    ctaLabel: 'Continue',
    busyLabel: 'Setting up your account…',
  }
}

export function deriveWaitlistDoneUi(canEnterApp: boolean): WaitlistDoneUi {
  if (canEnterApp) {
    return {
      title: 'Access approved',
      subtitle: 'Your account is ready and app access is live. Enter the app now, or open Accounts to manage identities and points.',
      primaryLabel: `${SHARE_SYMBOL_PREFIX} Enter App`,
      secondaryLabel: 'Open Accounts',
    }
  }

  return {
    title: 'Account ready',
    subtitle: 'Your account is set up. App access is still pending. Open Accounts to manage identities and points while you wait.',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Open Accounts`,
    secondaryLabel: null,
  }
}
