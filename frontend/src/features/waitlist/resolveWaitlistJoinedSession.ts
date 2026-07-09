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

/**
 * Joined waitlist UI requires a 4626 session.
 *
 * Once any session address is known (local OTP handoff, wallet handoff, or
 * server cookie after probe), keep the joined surface even if Privy briefly
 * flaps `ready` / `authenticated` in Base App WebViews. Requiring live Privy
 * auth for every render swaps signup ↔ joined via AnimatePresence and looks
 * like a broken flicker.
 */
export function resolveWaitlistJoinedSessionAddress(input: WaitlistJoinedSessionInput): string | null {
  if (input.walletSignInPending) return null

  const walletHandoffAddress = resolveWalletHandoffAddress(input)
  if (walletHandoffAddress) {
    return walletHandoffAddress
  }

  const local = trimAddress(input.localSessionAddress)
  if (local) return local

  const wallet = trimAddress(input.walletSessionAddress)
  if (wallet) return wallet

  const server = trimAddress(input.serverSessionAddress)
  if (!server || !input.sessionProbeComplete) return null
  return server
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
  // Local OTP/bootstrap session is authoritative — never treat as orphan.
  if (trimAddress(input.localSessionAddress)) return false
  if (trimAddress(input.walletSessionAddress) && !input.walletSignInPending) return false
  if (isWalletHandoffSession(input)) return false
  return Boolean(trimAddress(input.serverSessionAddress))
}
