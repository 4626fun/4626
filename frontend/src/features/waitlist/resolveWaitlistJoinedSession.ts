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

/** Joined waitlist UI requires both a 4626 session and an active Privy login. */
export function resolveWaitlistJoinedSessionAddress(input: WaitlistJoinedSessionInput): string | null {
  if (!input.sessionProbeComplete || !input.privyReady) return null
  if (input.walletSignInPending) return null
  if (!input.privyAuthenticated) return null

  return (
    trimAddress(input.localSessionAddress) ??
    trimAddress(input.walletSessionAddress) ??
    trimAddress(input.serverSessionAddress)
  )
}

/** Server session cookie without Privy auth — stale wallet/bootstrap handoff. */
export function shouldClearOrphanWaitlistServerSession(
  input: Pick<
    WaitlistJoinedSessionInput,
    'sessionProbeComplete' | 'privyReady' | 'privyAuthenticated' | 'walletSignInPending' | 'serverSessionAddress'
  >,
): boolean {
  if (!input.sessionProbeComplete || !input.privyReady) return false
  if (input.walletSignInPending) return false
  if (input.privyAuthenticated) return false
  return Boolean(trimAddress(input.serverSessionAddress))
}
