import type { Variant } from './waitlistTypes'

export type WaitlistStep = 'auth' | 'wallet' | 'done'

export function resolveWaitlistStep(params: {
  account: { emailVerified: boolean; appAccessStatus: string | null }
}): WaitlistStep {
  const { account } = params
  if (!account.emailVerified) return 'auth'
  const appApproved = String(account.appAccessStatus ?? '').trim().toLowerCase() === 'approved'
  if (appApproved) return 'done'
  return 'wallet'
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

export function shouldAutoHandoffApprovedAccount(params: {
  variant?: Variant
  step: WaitlistStep
  canEnterApp: boolean
  enterAppBusy: boolean
}): boolean {
  if (params.variant !== 'embedded') return false
  if (params.step !== 'done') return false
  if (!params.canEnterApp) return false
  if (params.enterAppBusy) return false
  return true
}
