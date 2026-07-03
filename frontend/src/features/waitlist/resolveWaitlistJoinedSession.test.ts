import { describe, expect, it } from 'vitest'

import {
  resolveWaitlistJoinedSessionAddress,
  shouldClearOrphanWaitlistServerSession,
} from './resolveWaitlistJoinedSession'

const BASE = {
  sessionProbeComplete: true,
  privyReady: true,
  privyAuthenticated: true,
  walletSignInPending: false,
  serverSessionAddress: '0xserver',
  localSessionAddress: null,
  walletSessionAddress: null,
} as const

describe('resolveWaitlistJoinedSessionAddress', () => {
  it('returns null until the server session probe completes', () => {
    expect(
      resolveWaitlistJoinedSessionAddress({
        ...BASE,
        sessionProbeComplete: false,
      }),
    ).toBeNull()
  })

  it('returns null when Privy is not authenticated', () => {
    expect(
      resolveWaitlistJoinedSessionAddress({
        ...BASE,
        privyAuthenticated: false,
      }),
    ).toBeNull()
  })

  it('returns null while returning wallet sign-in overlay is active', () => {
    expect(
      resolveWaitlistJoinedSessionAddress({
        ...BASE,
        walletSignInPending: true,
      }),
    ).toBeNull()
  })

  it('prefers local session from OTP/wallet handoff over server probe', () => {
    expect(
      resolveWaitlistJoinedSessionAddress({
        ...BASE,
        localSessionAddress: '0xlocal',
        walletSessionAddress: '0xwallet',
        serverSessionAddress: '0xserver',
      }),
    ).toBe('0xlocal')
  })

  it('falls back to server session when Privy is authenticated', () => {
    expect(
      resolveWaitlistJoinedSessionAddress({
        ...BASE,
        serverSessionAddress: '0xabc',
      }),
    ).toBe('0xabc')
  })
})

describe('shouldClearOrphanWaitlistServerSession', () => {
  it('clears when a server cookie exists without Privy auth', () => {
    expect(
      shouldClearOrphanWaitlistServerSession({
        sessionProbeComplete: true,
        privyReady: true,
        privyAuthenticated: false,
        walletSignInPending: false,
        serverSessionAddress: '0xorphan',
      }),
    ).toBe(true)
  })

  it('does not clear while wallet sign-in overlay is active', () => {
    expect(
      shouldClearOrphanWaitlistServerSession({
        sessionProbeComplete: true,
        privyReady: true,
        privyAuthenticated: false,
        walletSignInPending: true,
        serverSessionAddress: '0xorphan',
      }),
    ).toBe(false)
  })

  it('does not clear when Privy is authenticated', () => {
    expect(
      shouldClearOrphanWaitlistServerSession({
        sessionProbeComplete: true,
        privyReady: true,
        privyAuthenticated: true,
        walletSignInPending: false,
        serverSessionAddress: '0xabc',
      }),
    ).toBe(false)
  })
})
