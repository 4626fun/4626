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

  // The server session cookie is sufficient to gate API access.
  // Privy client-side auth is domain-specific and won't be
  // available on app.4626.fun after a cross-origin handoff from
  // 4626.fun. Let it bridge lazily once the user is in the app.
  return true
}

export type AppContinuePrivyWaitInput = {
  handoffRedeemed: boolean
  siweAuthAddress: string | null | undefined
  privyClientStatus: 'disabled' | 'loading' | 'ready'
  privyReady: boolean
  privyAuthenticated: boolean
}

export function shouldWaitForPrivyRehydrationAfterHandoff(_input: AppContinuePrivyWaitInput): boolean {
  // Navigation no longer blocks on Privy client auth.  Privy
  // sessions are domain-specific so rehydration after a
  // cross-origin handoff is best-effort / lazy.
  return false
}
