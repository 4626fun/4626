import { beforeEach, describe, expect, it, vi } from 'vitest'

const { claimOpinionIntentMock, transitionOpinionDecisionMock } = vi.hoisted(() => ({
  claimOpinionIntentMock: vi.fn(),
  transitionOpinionDecisionMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/inverseOpinionTradeStore.js', () => ({
  OpinionTradeStoreError: class OpinionTradeStoreError extends Error {
    code: string

    constructor(code: string) {
      super(code)
      this.code = code
    }
  },
  claimOpinionIntent: claimOpinionIntentMock,
  transitionOpinionDecision: transitionOpinionDecisionMock,
}))

import {
  claimInverseOpinionTradeIntent,
  recordInverseOpinionTradeSubmitted,
  recordInverseOpinionTradeTerminal,
  recordInverseOpinionTradeUnknown,
} from '../../server/_lib/alfaclub/inverseOpinionTradeRecorder.js'

const DECISION = {
  decisionId: '11111111-1111-4111-8111-111111111111',
  sourceMessageId: '22222222-2222-4222-8222-222222222222',
  intentOrdinal: 0,
  normalizedMarket: 'BTC',
  sourceSide: 'long' as const,
  inverseSide: 'short' as const,
  executionPhase: 'claimed' as const,
  terminalOutcome: null,
  reasonCode: null,
  executorWallet: null,
  requestedParameters: {},
  receiptSummary: {},
  attributionQuality: 'complete' as const,
  observedAt: '2026-07-14T08:00:00.000Z',
  submittedAt: null,
  resolvedAt: null,
  updatedAt: '2026-07-14T08:00:00.000Z',
  executionClaimToken: '66666666-6666-4666-8666-666666666666',
  executionClaimed: true,
}

describe('inverseOpinionTradeRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    claimOpinionIntentMock.mockResolvedValue(DECISION)
    transitionOpinionDecisionMock.mockResolvedValue(DECISION)
  })

  it('claims a privacy-safe bounded source snapshot with deterministic intent metadata', async () => {
    const text = `BTC looks bullish ${'without repeating raw source '.repeat(30)}`
    await claimInverseOpinionTradeIntent({
      roomId: '1484',
      intent: {
        id: 'message-77',
        date: Date.parse('2026-07-14T08:00:00.000Z'),
        sender: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        text,
        userSide: 'long',
        pair: 'BTC',
        ordinal: 0,
        parseMode: 'loose',
      },
    })

    expect(claimOpinionIntentMock).toHaveBeenCalledWith({
      source: {
        roomId: '1484',
        messageId: 'message-77',
        sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        excerpt: expect.stringMatching(/^BTC looks bullish/),
        senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        publicAuthorLabel: '0xaaaa…aaaa',
        sourceTimestamp: '2026-07-14T08:00:00.000Z',
      },
      intent: {
        ordinal: 0,
        normalizedMarket: 'BTC',
        sourceSide: 'long',
        inverseSide: 'short',
        attributionQuality: 'complete',
      },
    })
    const excerpt = claimOpinionIntentMock.mock.calls[0]?.[0]?.source?.excerpt
    expect(excerpt.length).toBeLessThanOrEqual(280)
    expect(excerpt).not.toBe(text)
  })

  it('keeps an existing public label and encodes HIP-3 markets for the U1 storage vocabulary', async () => {
    await claimInverseOpinionTradeIntent({
      roomId: '1659',
      intent: {
        id: 'message-hip3',
        date: 1_784_035_200,
        sender: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        publicAuthorLabel: '@creator',
        text: 'bullish $cards',
        userSide: 'long',
        pair: 'xyz:CARDS',
        ordinal: 1,
        parseMode: 'loose',
      },
    })

    expect(claimOpinionIntentMock).toHaveBeenCalledWith(expect.objectContaining({
      source: expect.objectContaining({
        publicAuthorLabel: '@creator',
        sourceTimestamp: '2026-07-14T13:20:00.000Z',
      }),
      intent: expect.objectContaining({
        ordinal: 1,
        normalizedMarket: 'XYZ.CARDS',
      }),
    }))
  })

  it('atomically claims submission metadata before execution', async () => {
    await expect(recordInverseOpinionTradeSubmitted({
      decision: DECISION,
      executorWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      requestedParameters: {
        action: 'open',
        pair: 'BTC',
        side: 'short',
        sizeUsd: 50,
        leverage: 27,
      },
      parseMode: 'strict',
    })).resolves.toBe(true)

    expect(transitionOpinionDecisionMock).toHaveBeenCalledWith({
      decisionId: DECISION.decisionId,
      executionPhase: 'submitted',
      executionClaimToken: DECISION.executionClaimToken,
      executorWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      requestedParameters: expect.objectContaining({
        action: 'open',
        pair: 'BTC',
        parseMode: 'strict',
      }),
    })
  })

  it('returns false when another claimant already advanced the decision', async () => {
    const { OpinionTradeStoreError } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
    transitionOpinionDecisionMock.mockRejectedValueOnce(new OpinionTradeStoreError('invalid_transition'))

    await expect(recordInverseOpinionTradeSubmitted({
      decision: DECISION,
      executorWallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      requestedParameters: { action: 'open', pair: 'BTC' },
      parseMode: 'strict',
    })).resolves.toBe(false)
  })

  it('records stable terminal and unknown execution states without source text', async () => {
    await recordInverseOpinionTradeTerminal({
      decision: DECISION,
      outcome: 'blocked',
      reasonCode: 'market_metadata_unavailable',
      receiptSummary: { parseMode: 'loose' },
    })
    await recordInverseOpinionTradeUnknown({
      decision: DECISION,
      reasonCode: 'arena_submit_unknown',
      receiptSummary: { timedOut: true },
    })

    expect(transitionOpinionDecisionMock).toHaveBeenNthCalledWith(1, {
      decisionId: DECISION.decisionId,
      executionPhase: 'resolved',
      terminalOutcome: 'blocked',
      reasonCode: 'market_metadata_unavailable',
      executionClaimToken: DECISION.executionClaimToken,
      receiptSummary: { parseMode: 'loose' },
    })
    expect(transitionOpinionDecisionMock).toHaveBeenNthCalledWith(2, {
      decisionId: DECISION.decisionId,
      executionPhase: 'unknown',
      reasonCode: 'arena_submit_unknown',
      receiptSummary: { timedOut: true },
    })
  })
})
