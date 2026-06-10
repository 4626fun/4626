import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const getDbInitErrorMock = vi.fn()
const isDbConfiguredMock = vi.fn()
const loggerInfoMock = vi.fn()
const loggerWarnMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
  getDbInitError: getDbInitErrorMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../infra/logger.js', () => ({
  logger: {
    info: loggerInfoMock,
    warn: loggerWarnMock,
  },
}))

vi.mock('../infra/telemetrySampling.js', () => ({
  shouldSampleEvent: () => true,
}))

describe('telegram link telemetry persistence', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.TELEGRAM_LINK_TELEMETRY_DB_PERSIST
    delete process.env.VERCEL
    delete process.env.VERCEL_ENV
    isDbConfiguredMock.mockReturnValue(true)
    getDbInitErrorMock.mockReturnValue(null)
    getDbMock.mockReset()
  })

  it('persists telemetry when the database is healthy', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    }
    getDbMock.mockResolvedValue(db)

    const { trackTelegramLinkEvent } = await import('./telegramLinkTelemetry.ts')
    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-1',
      payload: { hasEmail: true },
    })

    expect(getDbMock).toHaveBeenCalledTimes(1)
    expect(db.sql).toHaveBeenCalled()
    const insertCall = db.sql.mock.calls[db.sql.mock.calls.length - 1] as unknown as [TemplateStringsArray, ...unknown[]] | undefined
    expect(String(insertCall?.[0].join(' ') ?? '')).toContain('INSERT INTO telegram_link_telemetry_events')
    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      '[telegram/link-telemetry] db persistence paused',
      expect.anything(),
    )
  })

  it('skips persistence immediately when postgres init error already shows session saturation', async () => {
    getDbInitErrorMock.mockReturnValue('Max client connections reached')

    const { trackTelegramLinkEvent } = await import('./telegramLinkTelemetry.ts')
    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-2',
    })

    expect(getDbMock).not.toHaveBeenCalled()
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[telegram/link-telemetry] db persistence paused',
      expect.objectContaining({
        reason: 'postgres_session_mode_saturated',
      }),
    )
  })

  it('defaults to log-only telemetry on vercel unless DB persistence is explicitly enabled', async () => {
    process.env.VERCEL = '1'

    const { trackTelegramLinkEvent } = await import('./telegramLinkTelemetry.ts')
    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-vercel',
    })

    expect(getDbMock).not.toHaveBeenCalled()
    expect(loggerInfoMock).toHaveBeenCalledWith(
      '[telegram/link-telemetry] event',
      expect.objectContaining({
        event: 'telegram_link_email_code_send_started',
      }),
    )
  })

  it('allows explicit DB persistence on vercel when opted in', async () => {
    process.env.VERCEL = '1'
    process.env.TELEGRAM_LINK_TELEMETRY_DB_PERSIST = 'true'
    const db = {
      sql: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    }
    getDbMock.mockResolvedValue(db)

    const { trackTelegramLinkEvent } = await import('./telegramLinkTelemetry.ts')
    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-optin',
    })

    expect(getDbMock).toHaveBeenCalledTimes(1)
    expect(db.sql).toHaveBeenCalled()
  })

  it('enters backoff after a saturated getDb result and avoids hitting postgres again during the window', async () => {
    let initError: string | null = null
    getDbInitErrorMock.mockImplementation(() => initError)
    getDbMock.mockImplementation(async () => {
      initError = 'Max client connections reached'
      return null
    })

    const { trackTelegramLinkEvent } = await import('./telegramLinkTelemetry.ts')

    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-3a',
    })
    await trackTelegramLinkEvent({
      event: 'telegram_link_email_code_send_started',
      flowId: 'flow-3b',
    })

    expect(getDbMock).toHaveBeenCalledTimes(1)
    expect(loggerWarnMock).toHaveBeenCalledWith(
      '[telegram/link-telemetry] db persistence paused',
      expect.objectContaining({
        reason: 'postgres_session_mode_saturated',
      }),
    )
  })
})
