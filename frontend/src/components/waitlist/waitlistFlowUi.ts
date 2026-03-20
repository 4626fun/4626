import { SHARE_SYMBOL_PREFIX } from '@/lib/tokenSymbols'

export type WaitlistEmailUi = {
  title: string
  subtitle: string
  ctaLabel: string
  busyLabel: string
}

export type WaitlistZoraUi = {
  subtitle: string
  primaryAction: 'connect' | 'finish'
  primaryLabel: string
  secondaryAction: 'skip' | 'reconnect'
  secondaryLabel: string
  connectedLabel: string
  resolvingLabel: string
}

/** True when resolve/bootstrap returned at least one displayable Zora signal (not merely a non-null placeholder object). */
export function hasZoraProfileSignals(
  summary: {
    zoraHandle?: string | null
    canonicalCswAddress?: string | null
    creatorCoin?: { address?: string | null } | null
  } | null,
): boolean {
  if (!summary) return false
  const h = typeof summary.zoraHandle === 'string' ? summary.zoraHandle.trim() : ''
  if (h) return true
  const csw = typeof summary.canonicalCswAddress === 'string' ? summary.canonicalCswAddress.trim() : ''
  if (csw) return true
  const coin = typeof summary.creatorCoin?.address === 'string' ? summary.creatorCoin.address.trim() : ''
  return coin.length > 0
}

export type WaitlistDoneUi = {
  title: string
  subtitle: string
  primaryLabel: string
  secondaryLabel: string | null
}

export function canEnterAppFromAccountState(params: { appAccessStatus: string | null; tier: number }): boolean {
  const status = String(params.appAccessStatus ?? '').trim().toLowerCase()
  if (status === 'approved') return true
  return params.tier >= 1
}

export function deriveWaitlistEmailUi(step: 'email' | 'auth'): WaitlistEmailUi {
  if (step === 'auth') {
    return {
      title: 'Verify your email',
      subtitle: 'Finish creating your 4626 account with email OTP. Base and Zora are optional entry paths after that.',
      ctaLabel: `${SHARE_SYMBOL_PREFIX} Continue with email`,
      busyLabel: 'Opening email sign-in…',
    }
  }

  return {
    title: 'Get early access',
    subtitle: 'Enter your email to join.',
    ctaLabel: `${SHARE_SYMBOL_PREFIX} Join waitlist`,
    busyLabel: 'Setting up…',
  }
}

export function deriveWaitlistZoraUi(hasLinkedZora: boolean): WaitlistZoraUi {
  if (hasLinkedZora) {
    return {
      subtitle: 'We found your Zora profile from a linked wallet.',
      primaryAction: 'finish',
      primaryLabel: 'Continue',
      secondaryAction: 'reconnect',
      secondaryLabel: 'Link a different wallet',
      connectedLabel: 'Zora profile found',
      resolvingLabel: 'Resolving your Zora details…',
    }
  }

  return {
    subtitle: 'Link the wallet you use on Zora to import your profile and creator coin.',
    primaryAction: 'connect',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Link Zora wallet`,
    secondaryAction: 'skip',
    secondaryLabel: 'Continue without Zora',
    connectedLabel: 'Zora profile found',
    resolvingLabel: 'Resolving your Zora details…',
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
    subtitle: 'Visit accounts to manage connected identities, earn points, and track your status.',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Go to accounts`,
    secondaryLabel: null,
  }
}
