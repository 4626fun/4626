import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  getSessionAddressMock,
  isAdminAddressMock,
  regenerateMock,
  resolveUnknownMock,
  resolveTerminalReplyUnknownMock,
} = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  regenerateMock: vi.fn(),
  resolveUnknownMock: vi.fn(),
  resolveTerminalReplyUnknownMock: vi.fn(),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('@4626/server-core')
  return {
    ...actual,
    getSessionAddress: getSessionAddressMock,
    isAdminAddress: isAdminAddressMock,
    checkDurableRateLimit: vi.fn(async () => ({
      allowed: true,
      remaining: 1,
      resetAt: Date.now() + 1_000,
    })),
  }
})

vi.mock('../../server/_lib/alfaclub/inverseAkitaTradeJournal.js', () => ({
  regenerateInverseAkitaTradeJournal: regenerateMock,
  resolveInverseAkitaTradeJournalSendUnknown: resolveUnknownMock,
}))

vi.mock('../../server/_lib/alfaclub/inverseOpinionTradeStore.js', () => ({
  resolveTerminalReplyDeliverySendUnknown: resolveTerminalReplyUnknownMock,
}))

import handler from '../_handlers/v1/alfaclub/_trade-journal.ts'

describe('POST /api/v1/alfaclub/trade-journal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'machine-secret'
    getSessionAddressMock.mockReturnValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    isAdminAddressMock.mockReturnValue(true)
    regenerateMock.mockResolvedValue({
      sent: true,
      roomId: '1659',
      parentMessageId: 'parent-1',
      analysisRevision: 2,
    })
    resolveUnknownMock.mockResolvedValue({
      resolved: true,
      state: 'failed',
      parentMessageId: 'parent-confirmed',
    })
    resolveTerminalReplyUnknownMock.mockResolvedValue({
      decisionId: '11111111-1111-4111-8111-111111111111',
      deliveryKind: 'result',
      priorState: 'send_unknown',
      resultingState: 'sent',
      messageId: 'terminal-result-confirmed',
    })
  })

  it('rejects cron-secret-only regeneration without an admin session', async () => {
    getSessionAddressMock.mockReturnValue(null)
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: { confirm: 'REGENERATE', windowEnd: '2026-07-14T12:10:00.000Z' },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(401)
    expect(regenerateMock).not.toHaveBeenCalled()
  })

  it('requires machine auth and explicit confirmation', async () => {
    for (const [headers, confirm] of [
      [{}, 'REGENERATE'],
      [{ 'x-cron-secret': 'machine-secret' }, 'yes'],
    ] as const) {
      const req = createMockReq({
        method: 'POST',
        headers,
        body: { confirm, windowEnd: '2026-07-14T12:10:00.000Z' },
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(headers['x-cron-secret'] ? 400 : 401)
    }
    expect(regenerateMock).not.toHaveBeenCalled()
  })

  it('rejects unbounded or future windows', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        confirm: 'REGENERATE',
        windowStart: '2026-01-01T00:00:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(regenerateMock).not.toHaveBeenCalled()
  })

  it('passes the operator and bounded 24-hour window to append a revision', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        confirm: 'REGENERATE',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(regenerateMock).toHaveBeenCalledWith(expect.objectContaining({
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      window: {
        start: '2026-07-13T12:10:00.000Z',
        end: '2026-07-14T12:10:00.000Z',
      },
    }))
  })

  it('requires both admin and machine auth for explicit send_unknown resolution', async () => {
    for (const setup of [
      { session: null, headers: { 'x-cron-secret': 'machine-secret' } },
      {
        session: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        headers: {},
      },
    ]) {
      getSessionAddressMock.mockReturnValue(setup.session)
      const req = createMockReq({
        method: 'POST',
        headers: setup.headers,
        body: {
          action: 'resolve_send_unknown',
          resolution: 'mark_sent',
          confirm: 'RESOLVE_SEND_UNKNOWN',
          deliveryKind: 'parent',
          deliveryOrdinal: 0,
          knownMessageId: 'parent-confirmed',
          note: 'Confirmed in AlfaClub message history.',
          windowStart: '2026-07-13T12:10:00.000Z',
          windowEnd: '2026-07-14T12:10:00.000Z',
        },
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(401)
    }
    expect(resolveUnknownMock).not.toHaveBeenCalled()
  })

  it('passes bounded send_unknown resolution to the audited store path', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_send_unknown',
        resolution: 'mark_sent',
        confirm: 'RESOLVE_SEND_UNKNOWN',
        deliveryKind: 'parent',
        deliveryOrdinal: 0,
        knownMessageId: 'parent-confirmed',
        note: 'Confirmed in AlfaClub message history.',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(resolveUnknownMock).toHaveBeenCalledWith(expect.objectContaining({
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolution: 'mark_sent',
      deliveryKind: 'parent',
      deliveryOrdinal: 0,
      knownMessageId: 'parent-confirmed',
    }))
    expect(regenerateMock).not.toHaveBeenCalled()
  })

  it('passes an explicit revision send_unknown target with known message id and hash', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_send_unknown',
        target: 'revision',
        revision: 2,
        resolution: 'mark_sent',
        confirm: 'RESOLVE_SEND_UNKNOWN',
        knownMessageId: 'revision-confirmed',
        knownContentHash: 'a'.repeat(64),
        note: 'Confirmed in AlfaClub message history.',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(resolveUnknownMock).toHaveBeenCalledWith(expect.objectContaining({
      target: 'revision',
      revision: 2,
      resolution: 'mark_sent',
      knownMessageId: 'revision-confirmed',
      knownContentHash: 'a'.repeat(64),
    }))
  })

  it('rejects mark_sent revision resolution without both known id and content hash', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_send_unknown',
        target: 'revision',
        revision: 2,
        resolution: 'mark_sent',
        confirm: 'RESOLVE_SEND_UNKNOWN',
        knownMessageId: 'revision-confirmed',
        note: 'Confirmed in AlfaClub message history.',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(resolveUnknownMock).not.toHaveBeenCalled()
  })

  it('passes operator-confirmed failed revision resolution without send evidence', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_send_unknown',
        target: 'revision',
        revision: 3,
        resolution: 'mark_failed',
        confirm: 'RESOLVE_SEND_UNKNOWN',
        note: 'Operator confirmed no revision was published.',
        windowStart: '2026-07-13T12:10:00.000Z',
        windowEnd: '2026-07-14T12:10:00.000Z',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(resolveUnknownMock).toHaveBeenCalledWith(expect.objectContaining({
      target: 'revision',
      revision: 3,
      resolution: 'mark_failed',
      knownMessageId: null,
      knownContentHash: null,
    }))
  })

  it('requires admin, machine auth, and exact confirmation for terminal reply resolution', async () => {
    for (const setup of [
      { session: null, secret: 'machine-secret', confirm: 'RESOLVE_TERMINAL_REPLY_SEND_UNKNOWN' },
      {
        session: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        secret: '',
        confirm: 'RESOLVE_TERMINAL_REPLY_SEND_UNKNOWN',
      },
      {
        session: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        secret: 'machine-secret',
        confirm: 'yes',
      },
    ]) {
      getSessionAddressMock.mockReturnValue(setup.session)
      const req = createMockReq({
        method: 'POST',
        headers: setup.secret ? { 'x-cron-secret': setup.secret } : {},
        body: {
          action: 'resolve_terminal_reply_send_unknown',
          confirm: setup.confirm,
          decisionId: '11111111-1111-4111-8111-111111111111',
          deliveryKind: 'result',
          resolution: 'mark_sent',
          knownMessageId: 'terminal-result-confirmed',
          note: 'Confirmed in AlfaClub message history.',
        },
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(setup.session && setup.secret ? 400 : 401)
    }
    expect(resolveTerminalReplyUnknownMock).not.toHaveBeenCalled()
  })

  it.each([
    ['mark_sent', 'terminal-result-confirmed'],
    ['mark_failed', undefined],
  ] as const)('passes an explicit terminal reply %s resolution to the audited store', async (
    resolution,
    knownMessageId,
  ) => {
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_terminal_reply_send_unknown',
        confirm: 'RESOLVE_TERMINAL_REPLY_SEND_UNKNOWN',
        decisionId: '11111111-1111-4111-8111-111111111111',
        deliveryKind: 'result',
        resolution,
        ...(knownMessageId ? { knownMessageId } : {}),
        note: resolution === 'mark_sent'
          ? 'Confirmed in AlfaClub message history.'
          : 'Confirmed no AlfaClub message was published.',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(resolveTerminalReplyUnknownMock).toHaveBeenCalledWith({
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      decisionId: '11111111-1111-4111-8111-111111111111',
      deliveryKind: 'result',
      resolution,
      knownMessageId: knownMessageId ?? null,
      note: expect.any(String),
    })
  })

  it('returns conflict when the terminal reply is no longer send_unknown', async () => {
    resolveTerminalReplyUnknownMock.mockRejectedValueOnce(
      new Error('terminal_reply_send_unknown_resolution_conflict'),
    )
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'machine-secret' },
      body: {
        action: 'resolve_terminal_reply_send_unknown',
        confirm: 'RESOLVE_TERMINAL_REPLY_SEND_UNKNOWN',
        decisionId: '11111111-1111-4111-8111-111111111111',
        deliveryKind: 'receipt',
        resolution: 'mark_failed',
        note: 'Confirmed no AlfaClub message was published.',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
  })
})
