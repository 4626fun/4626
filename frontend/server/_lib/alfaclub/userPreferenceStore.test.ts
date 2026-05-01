import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const ensureSchemaMock = vi.fn(async () => {})
const loggerWarnMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureSchemaMock,
}))

vi.mock('../infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const VALID_ROOM = '12345'
const VALID_SENDER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PREF_KEY = 'hermit.spanish_dialect'

describe('userPreferenceStore — best-effort semantics', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getDbMock.mockReset()
    ensureSchemaMock.mockResolvedValue(undefined)
  })

  it('readUserPreference returns null when DB unavailable', async () => {
    getDbMock.mockResolvedValue(null)
    const { readUserPreference } = await import('./userPreferenceStore.ts')

    const result = await readUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
    })

    expect(result).toBeNull()
    // No warning needed for a missing-DB happy path.
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('readUserPreference returns null and warns on DB error', async () => {
    const sqlError = Object.assign(new Error('canceling statement due to statement timeout'), {
      code: '57014',
    })
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => {
        throw sqlError
      }),
    })

    const { readUserPreference } = await import('./userPreferenceStore.ts')
    const result = await readUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
    })

    expect(result).toBeNull()
    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
    const [, payload] = loggerWarnMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(payload.code).toBe('57014')
  })

  it('readUserPreference rejects malformed sender / room / key inputs', async () => {
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    })
    const { readUserPreference } = await import('./userPreferenceStore.ts')

    expect(
      await readUserPreference({ roomId: '', senderAddress: VALID_SENDER, preferenceKey: PREF_KEY }),
    ).toBeNull()
    expect(
      await readUserPreference({ roomId: VALID_ROOM, senderAddress: 'not-an-address', preferenceKey: PREF_KEY }),
    ).toBeNull()
    expect(
      await readUserPreference({
        roomId: VALID_ROOM,
        senderAddress: VALID_SENDER,
        preferenceKey: 'has spaces',
      }),
    ).toBeNull()
  })

  it('readUserPreference returns the persisted record when present', async () => {
    const row = {
      room_id: VALID_ROOM,
      sender_address: VALID_SENDER,
      preference_key: PREF_KEY,
      preference_value: 'mexico',
      updated_by: 'hermit.flag',
      updated_at: '2026-05-01T12:00:00Z',
    }
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => ({ rows: [row], rowCount: 1 })),
    })

    const { readUserPreference } = await import('./userPreferenceStore.ts')
    const result = await readUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
    })

    expect(result).toEqual({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
      preferenceValue: 'mexico',
      updatedBy: 'hermit.flag',
      updatedAt: '2026-05-01T12:00:00Z',
    })
  })

  it('upsertUserPreference returns false when DB unavailable, no exception thrown', async () => {
    getDbMock.mockResolvedValue(null)
    const { upsertUserPreference } = await import('./userPreferenceStore.ts')

    const ok = await upsertUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
      preferenceValue: 'argentina',
      updatedBy: 'hermit.flag',
    })

    expect(ok).toBe(false)
  })

  it('upsertUserPreference returns false and warns on DB error', async () => {
    const sqlError = Object.assign(new Error('permission denied for table user_preference'), {
      code: '42501',
    })
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => {
        throw sqlError
      }),
    })

    const { upsertUserPreference } = await import('./userPreferenceStore.ts')
    const ok = await upsertUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
      preferenceValue: 'mexico',
      updatedBy: 'hermit.flag',
    })

    expect(ok).toBe(false)
    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
  })

  it('upsertUserPreference returns true on successful write', async () => {
    const sqlMock = vi.fn(async () => ({ rows: [], rowCount: 1 }))
    getDbMock.mockResolvedValue({ sql: sqlMock })

    const { upsertUserPreference } = await import('./userPreferenceStore.ts')
    const ok = await upsertUserPreference({
      roomId: VALID_ROOM,
      senderAddress: VALID_SENDER,
      preferenceKey: PREF_KEY,
      preferenceValue: 'caribbean',
      updatedBy: 'hermit.text-hint',
    })

    expect(ok).toBe(true)
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('upsertUserPreference rejects malformed inputs without touching the DB', async () => {
    const sqlMock = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    getDbMock.mockResolvedValue({ sql: sqlMock })

    const { upsertUserPreference } = await import('./userPreferenceStore.ts')
    expect(
      await upsertUserPreference({
        roomId: '',
        senderAddress: VALID_SENDER,
        preferenceKey: PREF_KEY,
        preferenceValue: 'mexico',
      }),
    ).toBe(false)
    expect(
      await upsertUserPreference({
        roomId: VALID_ROOM,
        senderAddress: 'not-an-address',
        preferenceKey: PREF_KEY,
        preferenceValue: 'mexico',
      }),
    ).toBe(false)
    expect(
      await upsertUserPreference({
        roomId: VALID_ROOM,
        senderAddress: VALID_SENDER,
        preferenceKey: 'bad key with spaces',
        preferenceValue: 'mexico',
      }),
    ).toBe(false)

    expect(sqlMock).not.toHaveBeenCalled()
  })

  it('persistence is disabled when ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED=1', async () => {
    const prevValue = process.env.ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED
    process.env.ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED = '1'

    try {
      const sqlMock = vi.fn(async () => ({ rows: [], rowCount: 0 }))
      getDbMock.mockResolvedValue({ sql: sqlMock })

      const { readUserPreference, upsertUserPreference, deleteUserPreference } = await import(
        './userPreferenceStore.ts'
      )
      expect(
        await readUserPreference({
          roomId: VALID_ROOM,
          senderAddress: VALID_SENDER,
          preferenceKey: PREF_KEY,
        }),
      ).toBeNull()
      expect(
        await upsertUserPreference({
          roomId: VALID_ROOM,
          senderAddress: VALID_SENDER,
          preferenceKey: PREF_KEY,
          preferenceValue: 'mexico',
        }),
      ).toBe(false)
      expect(
        await deleteUserPreference({
          roomId: VALID_ROOM,
          senderAddress: VALID_SENDER,
          preferenceKey: PREF_KEY,
        }),
      ).toBe(false)

      expect(sqlMock).not.toHaveBeenCalled()
    } finally {
      if (prevValue === undefined) {
        delete process.env.ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED
      } else {
        process.env.ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED = prevValue
      }
    }
  })

  it('deleteUserPreference is idempotent and best-effort', async () => {
    const sqlMock = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    getDbMock.mockResolvedValue({ sql: sqlMock })

    const { deleteUserPreference } = await import('./userPreferenceStore.ts')
    expect(
      await deleteUserPreference({
        roomId: VALID_ROOM,
        senderAddress: VALID_SENDER,
        preferenceKey: PREF_KEY,
      }),
    ).toBe(true)
    expect(sqlMock).toHaveBeenCalledTimes(1)
  })
})
