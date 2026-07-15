import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  listMissing: vi.fn(),
  ensure: vi.fn(),
  claim: vi.fn(),
  markSent: vi.fn(),
  markFailed: vi.fn(),
  markUnknown: vi.fn(),
  backlog: vi.fn(),
}))
const sendStrict = vi.hoisted(() => vi.fn())
const senderReadiness = vi.hoisted(() => vi.fn())

vi.mock('../../server/_lib/alfaclub/inverseOpinionTradeStore.js', () => ({
  listTerminalDecisionsMissingReplyDelivery: store.listMissing,
  ensureTerminalReplyDeliveries: store.ensure,
  claimTerminalReplyDeliveries: store.claim,
  markTerminalReplyDeliverySent: store.markSent,
  markTerminalReplyDeliveryFailed: store.markFailed,
  markTerminalReplyDeliveryUnknown: store.markUnknown,
  readTerminalReplyDeliveryBacklog: store.backlog,
}))

vi.mock('../../server/_lib/alfaclub/inverseAkitaTradeJournalSender.js', () => ({
  readAlfaClubBotSenderReadiness: senderReadiness,
  sendAlfaClubBotTextStrict: sendStrict,
}))

const EXECUTED = {
  decisionId: '11111111-1111-4111-8111-111111111111',
  roomId: '1659',
  sourceMessageId: 'source-message-1',
  terminalOutcome: 'executed',
  reasonCode: 'arena_execution_succeeded',
  receiptSummary: {
    terminalReply: {
      ok: true,
      replyText: 'short BTC opened',
      threadReceiptText: 'receipt: short BTC filled',
      reactionEmoji: '🫡',
      counterSide: 'short',
      pair: 'BTC',
    },
  },
}

describe('durable inverse opinion terminal reply delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.listMissing.mockResolvedValue([])
    store.ensure.mockResolvedValue([])
    store.claim.mockResolvedValue([])
    store.markSent.mockResolvedValue(undefined)
    store.markFailed.mockResolvedValue(undefined)
    store.markUnknown.mockResolvedValue(undefined)
    store.backlog.mockResolvedValue({
      pending: 0,
      sending: 0,
      failed: 0,
      sendUnknown: 0,
      lastSuccessAt: null,
    })
    senderReadiness.mockReturnValue({ ready: true, errorCode: null })
    sendStrict.mockResolvedValue({ lane: 'bot_token_strict_reply', messageId: 'arena-message-1' })
  })

  it('reports a degraded run without creating or claiming rows when the bot key is absent', async () => {
    senderReadiness.mockReturnValueOnce({
      ready: false,
      errorCode: 'alfaclub_bot_token_missing',
    })
    store.backlog.mockResolvedValueOnce({
      pending: 4,
      sending: 0,
      failed: 1,
      sendUnknown: 2,
      lastSuccessAt: null,
    })
    const { sweepInverseOpinionTerminalReplyDeliveries } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )

    await expect(sweepInverseOpinionTerminalReplyDeliveries()).resolves.toMatchObject({
      created: 0,
      claimed: 0,
      errors: 1,
      degraded: true,
      errorCode: 'alfaclub_bot_token_missing',
      backlog: { pending: 4, failed: 1, sendUnknown: 2 },
    })
    expect(store.listMissing).not.toHaveBeenCalled()
    expect(store.ensure).not.toHaveBeenCalled()
    expect(store.claim).not.toHaveBeenCalled()
    expect(sendStrict).not.toHaveBeenCalled()
  })

  it('recovers an executed decision whose process crashed before creating a delivery row', async () => {
    store.listMissing.mockResolvedValueOnce([EXECUTED])
    store.claim
      .mockResolvedValueOnce([{
        decisionId: EXECUTED.decisionId,
        deliveryKind: 'result',
        roomId: EXECUTED.roomId,
        sourceMessageId: EXECUTED.sourceMessageId,
        publicText: 'short BTC opened',
        clientMessageId: `inverse-opinion:${EXECUTED.decisionId}:result`,
        claimantToken: '22222222-2222-4222-8222-222222222222',
      }])
      .mockResolvedValueOnce([])

    const { sweepInverseOpinionTerminalReplyDeliveries } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )
    const result = await sweepInverseOpinionTerminalReplyDeliveries()
    await sweepInverseOpinionTerminalReplyDeliveries()

    expect(store.ensure).toHaveBeenCalledWith(expect.objectContaining({
      decisionId: EXECUTED.decisionId,
      deliveries: expect.arrayContaining([
        expect.objectContaining({
          kind: 'result',
          clientMessageId: `inverse-opinion:${EXECUTED.decisionId}:result`,
          publicText: 'short BTC opened',
        }),
      ]),
    }))
    expect(sendStrict).toHaveBeenCalledTimes(1)
    expect(sendStrict).toHaveBeenCalledWith(expect.objectContaining({
      roomId: '1659',
      replyToMessageId: 'source-message-1',
      clientMessageId: `inverse-opinion:${EXECUTED.decisionId}:result`,
    }))
    expect(store.markSent).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'arena-message-1',
    }))
    expect(result).toMatchObject({ created: 2, sent: 1, errors: 0 })
  })

  it.each([
    ['rejected', 'market_ambiguous', /could not safely identify the market/i],
    ['blocked', 'arena_trading_disabled', /arena trading is off/i],
  ])('constructs a safe %s recovery from its persisted reason code', async (
    terminalOutcome,
    reasonCode,
    expected,
  ) => {
    store.listMissing.mockResolvedValueOnce([{
      ...EXECUTED,
      decisionId: `${terminalOutcome}-decision`,
      terminalOutcome,
      reasonCode,
      receiptSummary: {},
    }])
    const { sweepInverseOpinionTerminalReplyDeliveries } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )
    await sweepInverseOpinionTerminalReplyDeliveries()

    expect(store.ensure).toHaveBeenCalledWith(expect.objectContaining({
      deliveries: [expect.objectContaining({ kind: 'result', publicText: expect.stringMatching(expected) })],
    }))
  })

  it('uses the same stable idempotency key for immediate and recovery delivery', async () => {
    const claimed = {
      decisionId: EXECUTED.decisionId,
      deliveryKind: 'result',
      roomId: EXECUTED.roomId,
      sourceMessageId: EXECUTED.sourceMessageId,
      publicText: 'short BTC opened',
      clientMessageId: `inverse-opinion:${EXECUTED.decisionId}:result`,
      claimantToken: '22222222-2222-4222-8222-222222222222',
    }
    store.claim
      .mockResolvedValueOnce([claimed])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([claimed])
      .mockResolvedValueOnce([])
    const { deliverInverseOpinionTerminalReply } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )

    await deliverInverseOpinionTerminalReply(EXECUTED.decisionId)
    await deliverInverseOpinionTerminalReply(EXECUTED.decisionId)

    expect(sendStrict.mock.calls.map(([arg]) => arg.clientMessageId)).toEqual([
      claimed.clientMessageId,
      claimed.clientMessageId,
    ])
  })

  it('moves to send_unknown when the bot send succeeds but recording sent fails', async () => {
    store.claim.mockResolvedValueOnce([{
      decisionId: EXECUTED.decisionId,
      deliveryKind: 'result',
      roomId: EXECUTED.roomId,
      sourceMessageId: EXECUTED.sourceMessageId,
      publicText: 'short BTC opened',
      clientMessageId: `inverse-opinion:${EXECUTED.decisionId}:result`,
      claimantToken: '22222222-2222-4222-8222-222222222222',
    }])
    store.markSent.mockRejectedValueOnce(new Error('db unavailable'))
    const { deliverInverseOpinionTerminalReply } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )

    await expect(deliverInverseOpinionTerminalReply(EXECUTED.decisionId)).resolves.toMatchObject({
      sent: 0,
      sendUnknown: 1,
    })
    expect(store.markUnknown).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'sent_state_persist_failed',
    }))
    expect(sendStrict).toHaveBeenCalledTimes(1)
  })

  it('never claims send_unknown rows or invokes Arena execution', async () => {
    store.claim.mockResolvedValueOnce([])
    const { sweepInverseOpinionTerminalReplyDeliveries } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTerminalReplyDelivery.js'
    )
    await sweepInverseOpinionTerminalReplyDeliveries()

    expect(sendStrict).not.toHaveBeenCalled()
    expect(store.claim).toHaveBeenCalledWith(expect.objectContaining({
      states: ['pending', 'failed', 'expired_sending'],
    }))
  })

  it('keeps the recovery delivery graph free of Arena execution imports', () => {
    for (const file of [
      'inverseOpinionTerminalReplyDelivery.ts',
      'inverseOpinionTerminalReplyFormatter.ts',
      'inverseAkitaTradeJournalSender.ts',
    ]) {
      const source = readFileSync(
        resolve(process.cwd(), 'server/_lib/alfaclub', file),
        'utf8',
      )
      expect(source).not.toMatch(/from\s+['"][^'"]*\/arena\//)
      expect(source).not.toMatch(/\b(?:runArenaTrade|executeArenaTrade)\s*\(/)
    }
  })
})
