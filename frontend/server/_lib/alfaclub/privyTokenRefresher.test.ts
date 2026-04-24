import { describe, expect, it, vi } from 'vitest'

import {
  runAlfaClubPrivyRefreshOnce,
  type PrivyRefreshBundle,
} from './privyTokenRefresher.js'

/**
 * Build a JWT whose ONLY interesting property is its `exp` claim. We don't
 * care that the signature is bogus — the refresher only parses the payload
 * to decide whether a refresh is due.
 */
function jwtWithExp(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url')
  return `${header}.${payload}.sig`
}

function silentLog() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

describe('runAlfaClubPrivyRefreshOnce', () => {
  const NOW_MS = 1_800_000_000_000
  const now = () => NOW_MS

  it('returns missing_tokens when either bootstrap token is absent', async () => {
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => null,
      readRefreshToken: async () => 'rt-abc',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 60 * 60),
      refresh: async () => { throw new Error('should not be called') },
      writeBundle: async () => { throw new Error('should not be called') },
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('missing_tokens')
    if (outcome.status === 'missing_tokens') {
      expect(outcome.missing).toContain('ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN')
    }
  })

  it('skips refresh when identity token has ample time before expiry', async () => {
    // Identity token valid for 50 more minutes; near-expiry window is 20 min.
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 50 * 60),
      refresh: async () => { throw new Error('should not be called') },
      writeBundle: async () => { throw new Error('should not be called') },
      log: silentLog(),
      now,
      nearExpiryWindowMs: 20 * 60 * 1000,
    })
    expect(outcome.status).toBe('not_due')
    if (outcome.status === 'not_due') {
      expect(outcome.msUntilDue).toBeGreaterThan(20 * 60 * 1000)
    }
  })

  it('refreshes when identity token is inside the near-expiry window', async () => {
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60), // new 1h window
        refreshToken: 'rt-new', // rotated
      }),
    )
    const writes: Array<PrivyRefreshBundle> = []

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      // 10 minutes left on identity token — inside 20-minute window.
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 10 * 60),
      refresh,
      writeBundle: async (bundle) => { writes.push(bundle) },
      log: silentLog(),
      now,
      nearExpiryWindowMs: 20 * 60 * 1000,
    })

    expect(outcome.status).toBe('refreshed')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(writes).toHaveLength(1)
    expect(writes[0]).toEqual({
      accessToken: 'at-new',
      identityToken: expect.stringMatching(/^eyJ/),
      refreshToken: 'rt-new',
    })
  })

  it('force=true bypasses the near-expiry guard', async () => {
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-old', // unchanged
      }),
    )

    const outcome = await runAlfaClubPrivyRefreshOnce(
      {
        readAccessToken: async () => 'at-old',
        readRefreshToken: async () => 'rt-old',
        readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 59 * 60),
        refresh,
        writeBundle: async () => {},
        log: silentLog(),
        now,
        nearExpiryWindowMs: 20 * 60 * 1000,
      },
      { force: true },
    )
    expect(outcome.status).toBe('refreshed')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('returns error status when Privy refresh throws (bridge keeps running)', async () => {
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60), // near expiry
      refresh: async () => {
        throw new Error('privy_refresh_failed:400:Invalid auth token')
      },
      writeBundle: async () => { throw new Error('should not be called on error') },
      log: silentLog(),
      now,
      nearExpiryWindowMs: 20 * 60 * 1000,
    })
    expect(outcome.status).toBe('error')
    if (outcome.status === 'error') {
      expect(outcome.error).toContain('privy_refresh_failed')
    }
  })

  it('refreshes when identity token has no decodable exp (defensive)', async () => {
    // If we can't tell when the identity token expires, default to refreshing.
    // This is safer than silently running on a stale token.
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
    )
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => 'not.a.jwt',
      refresh,
      writeBundle: async () => {},
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('refreshed')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('reports status="error" when token persistence fails (P1 fix from PR #368 review)', async () => {
    // Regression guard: previously the default writeBundle silently ignored
    // upsert return values, so a DB outage during persist would return
    // 'refreshed' while leaving the bridge on stale credentials. The fix
    // surfaces any writeBundle throw as status:'error'.
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
    )
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh,
      writeBundle: async () => {
        throw new Error('token_persistence_failed:identity_token')
      },
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('error')
    if (outcome.status === 'error') {
      expect(outcome.error).toContain('token_persistence_failed')
    }
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('preserves the inbound refresh token when Privy does not rotate', async () => {
    const writes: Array<PrivyRefreshBundle> = []
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-stable',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        // Caller returned the SAME refresh_token (Privy did not rotate it).
        refreshToken: 'rt-stable',
      }),
      writeBundle: async (bundle) => { writes.push(bundle) },
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('refreshed')
    expect(writes[0]?.refreshToken).toBe('rt-stable')
  })
})
