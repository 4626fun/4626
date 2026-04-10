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
    title: 'Start with email',
    subtitle: 'Use one secure sign-in to save your spot. We guide the rest step by step.',
    ctaLabel: 'Continue',
    busyLabel: 'Preparing your account…',
  }
}

export function deriveWaitlistDoneUi(canEnterApp: boolean): WaitlistDoneUi {
  if (canEnterApp) {
    return {
      title: 'You are approved',
      subtitle: 'Your setup is complete and access is live. Enter the app now, or open Accounts for advanced controls.',
      primaryLabel: `${SHARE_SYMBOL_PREFIX} Enter App`,
      secondaryLabel: 'Open Accounts',
    }
  }

  return {
    title: 'Setup complete',
    subtitle: 'Your account is ready. App access is still pending. Open Accounts for advanced controls while approval catches up.',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Open Accounts`,
    secondaryLabel: null,
  }
}
