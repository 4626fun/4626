import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const ensureSchemaMock = vi.fn(async () => {})
const loggerErrorMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureSchemaMock,
}))

vi.mock('../infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
    debug: vi.fn(),
  },
}))

describe('upsertAlfaClubPrivyAccessToken — diagnostics on failure', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getDbMock.mockReset()
    ensureSchemaMock.mockResolvedValue(undefined)
  })

  it('logs a redacted DB error fingerprint when the upsert query rejects', async () => {
    const sqlError = Object.assign(new Error('permission denied for table alfaclub_runtime_secret'), {
      code: '42501',
      constraint: undefined,
      detail: 'role "anon" cannot INSERT',
      routine: 'aclcheck_error',
    })
    const db = {
      sql: vi.fn(async () => {
        throw sqlError
      }),
    }
    getDbMock.mockResolvedValue(db)

    const { upsertAlfaClubPrivyAccessToken } = await import('./chatTokenStore.ts')
    const ok = await upsertAlfaClubPrivyAccessToken({
      accessToken: 'aaaa.bbbb.cccc',
      updatedBy: 'unit-test',
    })

    expect(ok).toBe(false)
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)
    const [msg, payload] = loggerErrorMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(msg).toBe('[alfaclub-chat-token-store] privy secret upsert failed')
    expect(payload.secretKey).toBe('chat_privy_access_token')
    expect(payload.code).toBe('42501')
    expect(String(payload.message)).toContain('permission denied')
    expect(String(payload.detail)).toContain('anon')

    // Token material must NOT leak into logs.
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('aaaa.bbbb.cccc')
  })

  it('logs and returns false when getDb() returns null', async () => {
    getDbMock.mockResolvedValue(null)

    const { upsertAlfaClubPrivyAccessToken } = await import('./chatTokenStore.ts')
    const ok = await upsertAlfaClubPrivyAccessToken({
      accessToken: 'header.payload.sig',
    })

    expect(ok).toBe(false)
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[alfaclub-chat-token-store] privy secret upsert skipped: db unavailable',
      expect.objectContaining({ secretKey: 'chat_privy_access_token' }),
    )
  })

  it('returns true and does not log when the upsert succeeds', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [], rowCount: 1 })),
    }
    getDbMock.mockResolvedValue(db)

    const { upsertAlfaClubPrivyAccessToken } = await import('./chatTokenStore.ts')
    const ok = await upsertAlfaClubPrivyAccessToken({
      accessToken: 'header.payload.sig',
      updatedBy: 'unit-test',
    })

    expect(ok).toBe(true)
    expect(loggerErrorMock).not.toHaveBeenCalled()
  })
})

describe('upsertAlfaClubChatToken — diagnostics on failure', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getDbMock.mockReset()
    ensureSchemaMock.mockResolvedValue(undefined)
  })

  it('logs the underlying DB error and returns null when the chat-token upsert fails', async () => {
    const sqlError = Object.assign(new Error('canceling statement due to statement timeout'), {
      code: '57014',
    })
    const db = {
      sql: vi.fn(async () => {
        throw sqlError
      }),
    }
    getDbMock.mockResolvedValue(db)

    const { upsertAlfaClubChatToken } = await import('./chatTokenStore.ts')
    const meta = await upsertAlfaClubChatToken({ jwt: 'h.p.s', updatedBy: 'unit-test' })

    expect(meta).toBeNull()
    expect(loggerErrorMock).toHaveBeenCalledWith(
      '[alfaclub-chat-token-store] chat token upsert failed',
      expect.objectContaining({
        secretKey: 'chat_jwt',
        code: '57014',
      }),
    )
  })
})
