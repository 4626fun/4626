export type WaitlistJoinedSessionInput = {
  sessionProbeComplete: boolean
  privyReady: boolean
  privyAuthenticated: boolean
  walletSignInPending: boolean
  serverSessionAddress: string | null
  localSessionAddress: string | null
  walletSessionAddress: string | null
}

function trimAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isWalletHandoffSession(input: Pick<WaitlistJoinedSessionInput, 'walletSessionAddress' | 'localSessionAddress'>): boolean {
  const walletHandoff = trimAddress(input.walletSessionAddress)
  const local = trimAddress(input.localSessionAddress)
  if (!walletHandoff || !local) return false
  return walletHandoff.toLowerCase() === local.toLowerCase()
}

/** Parent-reported wallet sign-in success; local state may not have synced yet. */
function resolveWalletHandoffAddress(
  input: Pick<WaitlistJoinedSessionInput, 'walletSessionAddress' | 'localSessionAddress'>,
): string | null {
  const walletHandoff = trimAddress(input.walletSessionAddress)
  if (!walletHandoff) return null
  const local = trimAddress(input.localSessionAddress)
  if (local && local.toLowerCase() !== walletHandoff.toLowerCase()) return null
  return local ?? walletHandoff
}

/** Joined waitlist UI requires a 4626 session; wallet handoff may proceed before Privy restabilizes. */
export function resolveWaitlistJoinedSessionAddress(input: WaitlistJoinedSessionInput): string | null {
  if (input.walletSignInPending) return null

  const walletHandoffAddress = resolveWalletHandoffAddress(input)
  if (walletHandoffAddress) {
    return walletHandoffAddress
  }

  if (!input.sessionProbeComplete || !input.privyReady) return null
  if (!input.privyAuthenticated) return null

  return (
    trimAddress(input.localSessionAddress) ??
    trimAddress(input.walletSessionAddress) ??
    trimAddress(input.serverSessionAddress)
  )
}

export type OrphanWaitlistServerSessionInput = Pick<
  WaitlistJoinedSessionInput,
  | 'sessionProbeComplete'
  | 'privyReady'
  | 'privyAuthenticated'
  | 'walletSignInPending'
  | 'serverSessionAddress'
  | 'walletSessionAddress'
  | 'localSessionAddress'
> & {
  /** True while email OTP send/verify or post-auth bootstrap is in flight. */
  signupInProgress?: boolean
}

/** Server session cookie without Privy auth — stale wallet/bootstrap handoff. */
export function shouldClearOrphanWaitlistServerSession(input: OrphanWaitlistServerSessionInput): boolean {
  if (!input.sessionProbeComplete || !input.privyReady) return false
  if (input.walletSignInPending) return false
  if (input.signupInProgress) return false
  if (input.privyAuthenticated) return false
  if (trimAddress(input.walletSessionAddress) && !input.walletSignInPending) return false
  if (isWalletHandoffSession(input)) return false
  return Boolean(trimAddress(input.serverSessionAddress))
}
