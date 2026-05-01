import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  refreshPrivySession,
  runAlfaClubPrivyRefreshOnce,
  startAlfaClubPrivyTokenRefresher,
  type PrivyRefreshBundle,
} from './privyTokenRefresher.js'

const upsertAccessMock = vi.fn<
  (params: { accessToken: string; updatedBy?: string | null }) => Promise<boolean>
>()
const upsertRefreshMock = vi.fn<
  (params: { refreshToken: string; updatedBy?: string | null }) => Promise<boolean>
>()
const upsertChatMock = vi.fn<
  (params: { jwt: string; updatedBy?: string | null }) => Promise<{ hasToken: boolean } | null>
>()

vi.mock('./chatTokenStore.js', async () => {
  const actual = await vi.importActual<typeof import('./chatTokenStore.js')>(
    './chatTokenStore.js',
  )
  return {
    ...actual,
    readAlfaClubChatToken: vi.fn(async () => null),
    readAlfaClubPrivyAccessToken: vi.fn(async () => null),
    readAlfaClubPrivyRefreshToken: vi.fn(async () => null),
    upsertAlfaClubChatToken: (params: { jwt: string; updatedBy?: string | null }) =>
      upsertChatMock(params),
    upsertAlfaClubPrivyAccessToken: (params: {
      accessToken: string
      updatedBy?: string | null
    }) => upsertAccessMock(params),
    upsertAlfaClubPrivyRefreshToken: (params: {
      refreshToken: string
      updatedBy?: string | null
    }) => upsertRefreshMock(params),
  }
})

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

  it('regression: production Privy response with null privy_access_token + token-as-identity refreshes successfully', async () => {
    // This is the exact response shape that produced
    //   privy_refresh_failed:malformed_response:missing=privy_access_token
    //     :keys=created_at,expires_at,privy_access_token,refresh_token,
    //           session_update_action,token,user
    // 502s on /api/v1/alfaclub/chat-token-refresh after PR #417.
    const realFetch = globalThis.fetch
    try {
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          created_at: '2026-04-29T00:00:00Z',
          expires_at: '2026-04-29T01:00:00Z',
          privy_access_token: null,
          refresh_token: 'rt-rotated',
          session_update_action: 'set',
          token: 'eyJ-identity-jwt',
          user: { id: 'did:privy:abc' },
        }),
        text: async () => '',
      }) as unknown as Response) as unknown as typeof fetch

      const writes: Array<PrivyRefreshBundle> = []
      const outcome = await runAlfaClubPrivyRefreshOnce({
        readAccessToken: async () => 'at-old',
        readRefreshToken: async () => 'rt-old',
        readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
        // Use the real `refreshPrivySession` path via mocked fetch so we
        // exercise the response parser end to end.
        writeBundle: async (bundle) => { writes.push(bundle) },
        log: silentLog(),
        now,
      })

      expect(outcome.status).toBe('refreshed')
      expect(writes).toHaveLength(1)
      expect(writes[0]).toEqual({
        // Inbound access token preserved because Privy returned null.
        accessToken: 'at-old',
        identityToken: 'eyJ-identity-jwt',
        refreshToken: 'rt-rotated',
      })
    } finally {
      globalThis.fetch = realFetch
    }
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

describe('default writeBundle persistence semantics', () => {
  const NOW_MS = 1_800_000_000_000
  const now = () => NOW_MS

  beforeEach(() => {
    upsertAccessMock.mockReset()
    upsertRefreshMock.mockReset()
    upsertChatMock.mockReset()
  })

  it('skips access-token write when Privy did not rotate it (inbound === bundle)', async () => {
    upsertChatMock.mockResolvedValue({ hasToken: true })
    upsertRefreshMock.mockResolvedValue(true)

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-stable',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        // Privy returned null for privy_access_token; refresher preserved
        // the inbound access token verbatim.
        accessToken: 'at-stable',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
      log: silentLog(),
      now,
    })

    expect(outcome.status).toBe('refreshed')
    expect(upsertAccessMock).not.toHaveBeenCalled()
    expect(upsertRefreshMock).toHaveBeenCalledTimes(1)
    expect(upsertChatMock).toHaveBeenCalledTimes(1)
  })

  it('skips refresh-token write when Privy did not rotate it', async () => {
    upsertChatMock.mockResolvedValue({ hasToken: true })
    upsertAccessMock.mockResolvedValue(true)

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-stable',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-stable',
      }),
      log: silentLog(),
      now,
    })

    expect(outcome.status).toBe('refreshed')
    expect(upsertRefreshMock).not.toHaveBeenCalled()
    expect(upsertAccessMock).toHaveBeenCalledTimes(1)
    expect(upsertChatMock).toHaveBeenCalledTimes(1)
  })

  it('treats access-token persistence failure as non-fatal when identity-token write succeeds', async () => {
    // Production scenario: DB role has SELECT (RLS bypass) on
    // alfaclub_runtime_secret but lacks INSERT/UPDATE grants. The unrelated
    // access-token row write fails, but the identity-token row — written
    // last — succeeds. The refresher should report success because the
    // bridge only consumes the identity token.
    upsertAccessMock.mockResolvedValue(false)
    upsertRefreshMock.mockResolvedValue(true)
    upsertChatMock.mockResolvedValue({ hasToken: true })

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
      log: silentLog(),
      now,
    })

    expect(outcome.status).toBe('refreshed')
    expect(upsertChatMock).toHaveBeenCalledTimes(1)
  })

  it('reports error when identity-token persistence fails', async () => {
    // The identity token is the only credential the bridge consumes, and
    // it always rotates on a successful Privy refresh — failing to persist
    // it is the one case that must surface as status:"error".
    upsertAccessMock.mockResolvedValue(true)
    upsertRefreshMock.mockResolvedValue(true)
    upsertChatMock.mockResolvedValue(null)

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
      log: silentLog(),
      now,
    })

    expect(outcome.status).toBe('error')
    if (outcome.status === 'error') {
      expect(outcome.error).toContain('token_persistence_failed:identity_token')
    }
  })
})

describe('startAlfaClubPrivyTokenRefresher boot behavior', () => {
  it('force-refreshes on the first tick after boot so cold starts mid-lifetime always get fresh tokens', async () => {
    // Regression guard for the post-merge bug found in production on PR #368:
    // if the refresher booted when the current identity token had, say, 25
    // minutes of life left — above the 20-minute near-expiry window but
    // below the 30-minute interval — the first tick would report `not_due`
    // and the NEXT scheduled tick would hit after both access + identity
    // tokens had expired (they share a TTL), causing the refresh to fail
    // with 400 and leaving the bridge on stale credentials until operator
    // re-bootstrap. The fix: first tick after boot always uses force: true.

    // Identity token has 25 minutes of life left — comfortably outside a
    // 20-min near-expiry window but inside a 30-min interval.
    const NOW_MS = 1_800_000_000_000
    const exp = NOW_MS / 1000 + 25 * 60
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: `x.${Buffer.from(
          JSON.stringify({ exp: NOW_MS / 1000 + 60 * 60 }),
        ).toString('base64url')}.sig`,
        refreshToken: 'rt-new',
      }),
    )
    const deps = {
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () =>
        `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`,
      refresh,
      writeBundle: vi.fn(async () => {}),
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      now: () => NOW_MS,
      nearExpiryWindowMs: 20 * 60 * 1000,
    }

    // Interval 1h so only the first (microtask) tick fires during this
    // test. We just need to observe that Privy's refresh endpoint WAS
    // called even though the identity token wasn't inside the near-
    // expiry window — i.e., the force flag was applied.
    const handle = startAlfaClubPrivyTokenRefresher({
      intervalMs: 60 * 60 * 1000,
      deps,
      force: true,
    })

    // queueMicrotask uses the microtask queue; one turn of the scheduler
    // is enough to flush.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    // Also drain one more pending microtask — the inner tick is async.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(deps.writeBundle).toHaveBeenCalledTimes(1)

    handle.stop()
  })
})

describe('refreshPrivySession Privy response parsing', () => {
  const realFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
    const ok = init.ok ?? true
    const status = init.status ?? 200
    globalThis.fetch = vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }) as unknown as Response) as unknown as typeof fetch
  }

  it('accepts the canonical response with `identity_token`', async () => {
    mockFetchOnce({
      privy_access_token: 'at-new',
      identity_token: 'id-new',
      refresh_token: 'rt-new',
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle).toEqual({
      accessToken: 'at-new',
      identityToken: 'id-new',
      refreshToken: 'rt-new',
    })
  })

  it('falls back to top-level `token` when `identity_token` is omitted (matches Privy SDK ValidSessionResponse)', async () => {
    // Privy's `ValidSessionResponse` declares `identity_token` as OPTIONAL
    // and always carries the JWT in the top-level `token` field. Reject
    // those responses with malformed_response is exactly the production bug
    // observed on the new chat-token-refresh endpoint.
    mockFetchOnce({
      token: 'id-from-token-field',
      privy_access_token: 'at-new',
      refresh_token: 'rt-new',
      user: { id: 'did:privy:abc' },
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle).toEqual({
      accessToken: 'at-new',
      identityToken: 'id-from-token-field',
      refreshToken: 'rt-new',
    })
  })

  it('preserves the inbound refresh token when Privy returns refresh_token: null', async () => {
    mockFetchOnce({
      privy_access_token: 'at-new',
      identity_token: 'id-new',
      refresh_token: null,
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle.refreshToken).toBe('rt-old')
  })

  it('throws malformed_response with diagnostic key list when both identity_token AND token are absent', async () => {
    mockFetchOnce({
      privy_access_token: 'at-new',
      refresh_token: 'rt-new',
      // both identity_token and token absent — no JWT to fall back on
      session_update_action: 'set',
    })
    await expect(
      refreshPrivySession({ accessToken: 'at-old', refreshToken: 'rt-old' }),
    ).rejects.toThrow(/malformed_response:missing=identity_token\|token:keys=privy_access_token,refresh_token,session_update_action/)
  })

  it('preserves the inbound access token when privy_access_token is null (matches production Privy response)', async () => {
    // Production regression guard: alfaclub Privy app returns
    //   { token, refresh_token, privy_access_token: null, ... }
    // for sessions where the existing access token is still valid. The
    // refresher must NOT throw `malformed_response` here; instead it
    // preserves the inbound access token (same pattern as `refresh_token`)
    // so the next refresh still has a valid Bearer credential.
    mockFetchOnce({
      privy_access_token: null,
      token: 'id-from-token-field',
      refresh_token: 'rt-new',
      session_update_action: 'set',
      user: { id: 'did:privy:abc' },
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle).toEqual({
      accessToken: 'at-old',
      identityToken: 'id-from-token-field',
      refreshToken: 'rt-new',
    })
  })

  it('preserves the inbound access token when privy_access_token is omitted entirely', async () => {
    mockFetchOnce({
      identity_token: 'id-new',
      refresh_token: 'rt-new',
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle).toEqual({
      accessToken: 'at-old',
      identityToken: 'id-new',
      refreshToken: 'rt-new',
    })
  })

  it('preserves the inbound access token when privy_access_token is empty/whitespace', async () => {
    mockFetchOnce({
      privy_access_token: '   ',
      identity_token: 'id-new',
      refresh_token: 'rt-new',
    })
    const bundle = await refreshPrivySession({
      accessToken: 'at-old',
      refreshToken: 'rt-old',
    })
    expect(bundle.accessToken).toBe('at-old')
  })

  it('throws privy_refresh_failed:<status> on non-2xx without consulting the body shape', async () => {
    mockFetchOnce({ error: 'Invalid auth token' }, { ok: false, status: 400 })
    await expect(
      refreshPrivySession({ accessToken: 'at-old', refreshToken: 'rt-old' }),
    ).rejects.toThrow(/privy_refresh_failed:400/)
  })
})

describe('startAlfaClubPrivyTokenRefresher env gate', () => {
  const ENV_KEY = 'ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED'
  let priorEnv: string | undefined

  beforeEach(() => {
    priorEnv = process.env[ENV_KEY]
    delete process.env[ENV_KEY]
  })

  afterEach(() => {
    if (priorEnv === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = priorEnv
  })

  it('returns started:false reason:disabled when env flag is unset (default)', () => {
    const refresh = vi.fn()
    const handle = startAlfaClubPrivyTokenRefresher({
      deps: {
        readAccessToken: async () => 'at',
        readRefreshToken: async () => 'rt',
        readIdentityToken: async () => null,
        refresh,
        writeBundle: vi.fn(),
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    })
    expect(handle.started).toBe(false)
    expect(handle.reason).toBe('disabled')
    handle.stop()
  })

  it('does not call refresh or writeBundle when disabled', async () => {
    const refresh = vi.fn()
    const writeBundle = vi.fn()
    const handle = startAlfaClubPrivyTokenRefresher({
      deps: {
        readAccessToken: async () => 'at',
        readRefreshToken: async () => 'rt',
        readIdentityToken: async () => null,
        refresh,
        writeBundle,
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    })
    // Drain microtasks; an enabled refresher would have invoked refresh by now.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    expect(refresh).not.toHaveBeenCalled()
    expect(writeBundle).not.toHaveBeenCalled()
    expect(handle.started).toBe(false)
    handle.stop()
  })

  it('runNow on a disabled handle is a no-op error outcome', async () => {
    const handle = startAlfaClubPrivyTokenRefresher({
      deps: {
        readAccessToken: async () => 'at',
        readRefreshToken: async () => 'rt',
        readIdentityToken: async () => null,
        refresh: vi.fn(),
        writeBundle: vi.fn(),
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    })
    const outcome = await handle.runNow()
    expect(outcome).toEqual({ status: 'error', error: 'refresher_disabled' })
    handle.stop()
  })

  for (const value of ['1', 'true', 'yes', 'on', 'TRUE']) {
    it(`enables the loop when env flag is "${value}"`, async () => {
      process.env[ENV_KEY] = value
      const refresh = vi.fn(
        async (): Promise<PrivyRefreshBundle> => ({
          accessToken: 'at-new',
          identityToken: 'id-new',
          refreshToken: 'rt-new',
        }),
      )
      const writeBundle = vi.fn(async () => {})
      const handle = startAlfaClubPrivyTokenRefresher({
        intervalMs: 60 * 60 * 1000,
        deps: {
          readAccessToken: async () => 'at',
          readRefreshToken: async () => 'rt',
          readIdentityToken: async () => null,
          refresh,
          writeBundle,
          log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
      })
      expect(handle.started).toBe(true)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      expect(refresh).toHaveBeenCalledTimes(1)
      handle.stop()
    })
  }

  it('opts.force=true bypasses the env gate', async () => {
    delete process.env[ENV_KEY]
    const refresh = vi.fn(
      async (): Promise<PrivyRefreshBundle> => ({
        accessToken: 'at-new',
        identityToken: 'id-new',
        refreshToken: 'rt-new',
      }),
    )
    const handle = startAlfaClubPrivyTokenRefresher({
      intervalMs: 60 * 60 * 1000,
      force: true,
      deps: {
        readAccessToken: async () => 'at',
        readRefreshToken: async () => 'rt',
        readIdentityToken: async () => null,
        refresh,
        writeBundle: vi.fn(async () => {}),
        log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    })
    expect(handle.started).toBe(true)
    handle.stop()
  })

  it('value "0" or "false" leaves the loop disabled', () => {
    process.env[ENV_KEY] = '0'
    const handle1 = startAlfaClubPrivyTokenRefresher({
      deps: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    })
    expect(handle1.started).toBe(false)
    handle1.stop()
    process.env[ENV_KEY] = 'false'
    const handle2 = startAlfaClubPrivyTokenRefresher({
      deps: { log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
    })
    expect(handle2.started).toBe(false)
    handle2.stop()
  })
})

describe('runAlfaClubPrivyRefreshOnce health recording', () => {
  const NOW_MS = 1_800_000_000_000
  const now = () => NOW_MS

  it('records a refresh-success row with redacted metadata only', async () => {
    const recordSuccess = vi.fn(async (_payload: Record<string, unknown>) => true)
    const recordFailure = vi.fn(async (_payload: Record<string, unknown>, _writer: string) => true)
    const newIdentityExp = NOW_MS / 1000 + 60 * 60

    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(newIdentityExp),
        refreshToken: 'rt-new',
      }),
      writeBundle: async () => {},
      recordSuccess,
      recordFailure,
      log: silentLog(),
      now,
    })

    expect(outcome.status).toBe('refreshed')
    expect(recordSuccess).toHaveBeenCalledTimes(1)
    expect(recordFailure).not.toHaveBeenCalled()

    const arg = recordSuccess.mock.calls[0]?.[0]
    expect(arg).toMatchObject({
      writer: 'privy-token-refresher',
      rotatedRefresh: true,
      identityTokenExp: new Date(newIdentityExp * 1000).toISOString(),
    })
    // Crucially: the payload carries only metadata, never the JWT itself.
    const serialized = JSON.stringify(arg)
    expect(serialized).not.toContain('at-new')
    expect(serialized).not.toContain('rt-new')
    expect(serialized).not.toMatch(/eyJhbGc/i) // any JWT fragment
  })

  it('marks rotatedRefresh:false when Privy keeps the existing refresh token', async () => {
    const recordSuccess = vi.fn(async (_payload: Record<string, unknown>) => true)
    await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-old', // unrotated
      }),
      writeBundle: async () => {},
      recordSuccess,
      recordFailure: async () => true,
      log: silentLog(),
      now,
    })
    expect(recordSuccess.mock.calls[0]?.[0]?.rotatedRefresh).toBe(false)
  })

  it('records a missing_tokens failure row when bootstrap tokens absent', async () => {
    const recordSuccess = vi.fn(async (_payload: Record<string, unknown>) => true)
    const recordFailure = vi.fn(async (_payload: Record<string, unknown>, _writer: string) => true)
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => null,
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => null,
      refresh: async () => { throw new Error('should not be called') },
      writeBundle: async () => { throw new Error('should not be called') },
      recordSuccess,
      recordFailure,
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('missing_tokens')
    expect(recordFailure).toHaveBeenCalledTimes(1)
    expect(recordSuccess).not.toHaveBeenCalled()
    const [payload, writer] = recordFailure.mock.calls[0] ?? []
    expect(payload).toMatchObject({
      status: 'missing_tokens',
      errorCode: 'unknown',
    })
    expect(writer).toBe('privy-token-refresher')
  })

  it('records an error failure row when Privy refresh throws', async () => {
    const recordSuccess = vi.fn(async (_payload: Record<string, unknown>) => true)
    const recordFailure = vi.fn(async (_payload: Record<string, unknown>, _writer: string) => true)
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => {
        throw new Error('privy_refresh_failed:400:{"error":"Invalid auth token"}')
      },
      writeBundle: async () => {},
      recordSuccess,
      recordFailure,
      log: silentLog(),
      now,
    })
    expect(outcome.status).toBe('error')
    expect(recordSuccess).not.toHaveBeenCalled()
    expect(recordFailure).toHaveBeenCalledTimes(1)
    const [payload] = recordFailure.mock.calls[0] ?? []
    expect(payload).toMatchObject({
      status: 'error',
      errorCode: 'privy_refresh_failed:400',
    })
  })

  it('refresh succeeds even when health-row writers throw (best-effort)', async () => {
    const outcome = await runAlfaClubPrivyRefreshOnce({
      readAccessToken: async () => 'at-old',
      readRefreshToken: async () => 'rt-old',
      readIdentityToken: async () => jwtWithExp(NOW_MS / 1000 + 5 * 60),
      refresh: async () => ({
        accessToken: 'at-new',
        identityToken: jwtWithExp(NOW_MS / 1000 + 60 * 60),
        refreshToken: 'rt-new',
      }),
      writeBundle: async () => {},
      recordSuccess: async () => { throw new Error('health-store-down') },
      recordFailure: async () => { throw new Error('health-store-down') },
      log: silentLog(),
      now,
    })
    // Refresh outcome must be unaffected.
    expect(outcome.status).toBe('refreshed')
  })
})
