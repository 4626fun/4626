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
      title: 'Secure your spot',
      subtitle: 'We saved your email. Finish connecting your 4626 account to continue.',
      ctaLabel: `${SHARE_SYMBOL_PREFIX} Continue`,
      busyLabel: 'Opening sign-in…',
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
      subtitle: 'Connect your Zora account to import your profile and creator coin. Optional.',
      primaryAction: 'finish',
      primaryLabel: 'Continue',
      secondaryAction: 'reconnect',
      secondaryLabel: 'Reconnect Zora',
      connectedLabel: 'Zora account connected',
      resolvingLabel: 'Connected. Finishing your Zora details…',
    }
  }

  return {
    subtitle: 'Connect your Zora account to import your profile and creator coin. Optional.',
    primaryAction: 'connect',
    primaryLabel: `${SHARE_SYMBOL_PREFIX} Connect Zora`,
    secondaryAction: 'skip',
    secondaryLabel: 'Continue without Zora',
    connectedLabel: 'Zora account connected',
    resolvingLabel: 'Connected. Finishing your Zora details…',
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
