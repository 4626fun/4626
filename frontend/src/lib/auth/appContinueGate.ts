export type AppContinueGateInput = {
  autoLogin: boolean
  fromWaitlist: boolean
  siweAuthAddress: string | null | undefined
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  privyReady: boolean
  privyAuthenticated: boolean
}

export function shouldNavigateAfterWaitlistHandoff(input: AppContinueGateInput): boolean {
  if (!input.autoLogin || !input.fromWaitlist) return true

  const hasSiweSession = typeof input.siweAuthAddress === 'string' && input.siweAuthAddress.trim().length > 0
  if (!hasSiweSession) return false

  if (input.privyClientStatus !== 'ready') return true
  if (!input.privyReady) return false
  return input.privyAuthenticated
}

export type AppContinuePrivyWaitInput = {
  handoffRedeemed: boolean
  siweAuthAddress: string | null | undefined
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  privyReady: boolean
  privyAuthenticated: boolean
}

export function shouldWaitForPrivyRehydrationAfterHandoff(input: AppContinuePrivyWaitInput): boolean {
  if (!input.handoffRedeemed) return false

  const hasSiweSession = typeof input.siweAuthAddress === 'string' && input.siweAuthAddress.trim().length > 0
  if (!hasSiweSession) return false

  if (input.privyClientStatus !== 'ready') return false
  if (!input.privyReady) return false
  return !input.privyAuthenticated
}
