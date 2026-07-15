import { describe, expect, it } from 'vitest'

import {
  formatInverseAkitaTradeJournal,
  sanitizeInverseAkitaPublicLabel,
  type InverseAkitaTradeJournalBundle,
} from '../../server/_lib/alfaclub/inverseAkitaTradeJournal.js'

const BASE: InverseAkitaTradeJournalBundle = {
  window: {
    start: '2026-07-13T12:10:00.000Z',
    end: '2026-07-14T12:10:00.000Z',
  },
  decisions: [
    {
      decisionId: 'decision-1',
      executionPhase: 'resolved',
      terminalOutcome: 'executed',
      reasonCode: null,
      normalizedMarket: 'BTC',
      sourceSide: 'long',
      inverseSide: 'short',
      roomId: '1484',
      publicAuthorLabel: '@creator',
      senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      sourceTimestamp: '2026-07-14T10:00:00.000Z',
    },
    {
      decisionId: 'decision-2',
      executionPhase: 'resolved',
      terminalOutcome: 'rejected',
      reasonCode: 'risk_limit',
      normalizedMarket: 'ETH',
      sourceSide: 'short',
      inverseSide: 'long',
      roomId: '1659',
      publicAuthorLabel: null,
      senderAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      sourceTimestamp: '2026-07-14T11:00:00.000Z',
    },
    {
      decisionId: 'decision-3',
      executionPhase: 'resolved',
      terminalOutcome: 'blocked',
      reasonCode: 'execution_disabled',
      normalizedMarket: 'SOL',
      sourceSide: 'long',
      inverseSide: 'short',
      roomId: '2',
      publicAuthorLabel: '@other',
      senderAddress: null,
      sourceTimestamp: '2026-07-14T11:10:00.000Z',
    },
    {
      decisionId: 'decision-4',
      executionPhase: 'resolved',
      terminalOutcome: 'failed',
      reasonCode: 'acp_rejected',
      normalizedMarket: 'HYPE',
      sourceSide: 'short',
      inverseSide: 'long',
      roomId: '1043',
      publicAuthorLabel: '@third',
      senderAddress: null,
      sourceTimestamp: '2026-07-14T11:20:00.000Z',
    },
  ],
  trades: [{
    lifecycleId: 'lifecycle-1',
    state: 'open',
    market: 'BTC',
    side: 'short',
    openedAt: '2026-07-12T10:00:00.000Z',
    closedAt: null,
    dataAsOf: '2026-07-14T08:00:00.000Z',
    unrealizedPnlUsd: 42,
    realizedPnlUsd: null,
    attribution: {
      label: '@creator',
      roomId: '1484',
      paraphrase: 'Expressed a bullish view on BTC.',
      influences: [{
        decisionId: 'decision-1',
        label: '@creator',
        roomId: '1484',
        paraphrase: 'Expressed a bullish view on BTC.',
        action: 'open',
        occurredAt: '2026-07-12T10:00:00.000Z',
      }, {
        decisionId: 'decision-add',
        label: '0xcccc…cccc',
        roomId: '1043',
        paraphrase: 'Expressed a bearish view on BTC.',
        action: 'add',
        occurredAt: '2026-07-13T11:00:00.000Z',
      }],
    },
    analysis: {
      verdict: 'hold',
      confidence: 0.7,
      interpretation: 'The inverse thesis remains supported by recorded evidence.',
      invalidationCondition: 'BTC reclaims the invalidation level.',
      watchCondition: 'Watch funding normalization.',
      closedThesisAssessment: null,
    },
  }, {
    lifecycleId: 'lifecycle-2',
    state: 'closed',
    market: 'ETH',
    side: 'long',
    openedAt: '2026-07-13T10:00:00.000Z',
    closedAt: '2026-07-14T09:00:00.000Z',
    dataAsOf: '2026-07-14T09:00:00.000Z',
    unrealizedPnlUsd: null,
    realizedPnlUsd: -10,
    attribution: {
      label: '0xbbbb…bbbb',
      roomId: '1659',
      paraphrase: 'Expressed a bearish view on ETH.',
      influences: [{
        decisionId: 'decision-eth',
        label: '0xbbbb…bbbb',
        roomId: '1659',
        paraphrase: 'Expressed a bearish view on ETH.',
        action: 'open',
        occurredAt: '2026-07-13T10:00:00.000Z',
      }],
    },
    analysis: {
      verdict: 'watch',
      confidence: 0.5,
      interpretation: 'The closed lifecycle is recorded.',
      invalidationCondition: 'Lifecycle is closed.',
      watchCondition: 'Watch future qualified opinions.',
      closedThesisAssessment: 'invalidated',
    },
  }],
  generatedAt: '2026-07-14T12:10:00.000Z',
}

describe('InverseAKITA journal formatter', () => {
  it('renders complete counts, grouped reason codes, and stale evidence warning', () => {
    const formatted = formatInverseAkitaTradeJournal({
      ...BASE,
      trades: [
        ...BASE.trades,
        {
          ...BASE.trades[0],
          lifecycleId: 'lifecycle-incomplete',
          state: 'incomplete',
          attribution: { ...BASE.trades[0].attribution },
        },
        ...(['pending', 'partial', 'ambiguous'] as const).map((state) => ({
          ...BASE.trades[0],
          lifecycleId: `lifecycle-${state}`,
          state,
          attribution: { ...BASE.trades[0].attribution },
        })),
      ],
    })
    expect(formatted.parent).toContain('qualified 4')
    expect(formatted.parent).toContain('executed 1')
    expect(formatted.parent).toContain('rejected 1')
    expect(formatted.parent).toContain('blocked 1')
    expect(formatted.parent).toContain('failed 1')
    expect(formatted.parent).toContain('open 1')
    expect(formatted.parent).toContain('closed 1')
    expect(formatted.parent).toContain('pending 1')
    expect(formatted.parent).toContain('partial 1')
    expect(formatted.parent).toContain('ambiguous 1')
    expect(formatted.parent).toContain('incomplete 1')
    expect(formatted.parent).not.toContain('open 5')
    expect(formatted.parent).toContain('risk_limit ×1')
    expect(formatted.parent).toContain('execution_disabled ×1')
    expect(formatted.parent).toContain('acp_rejected ×1')
    expect(formatted.parent).toContain('data_as_of 2026-07-14T08:00:00.000Z')
  })

  it('reports unresolved execution phases separately from terminal incomplete outcomes', () => {
    const formatted = formatInverseAkitaTradeJournal({
      ...BASE,
      decisions: [{
        ...BASE.decisions[0],
        decisionId: 'claimed',
        executionPhase: 'claimed',
        terminalOutcome: null,
      }, {
        ...BASE.decisions[0],
        decisionId: 'submitted',
        executionPhase: 'submitted',
        terminalOutcome: null,
      }, {
        ...BASE.decisions[0],
        decisionId: 'unknown',
        executionPhase: 'unknown',
        terminalOutcome: null,
      }, {
        ...BASE.decisions[0],
        decisionId: 'incomplete',
        executionPhase: 'resolved',
        terminalOutcome: 'incomplete',
        reasonCode: 'execution_evidence_window_expired',
      }],
      trades: [],
    })

    expect(formatted.parent).toContain('qualified 4')
    expect(formatted.parent).toContain('execution unresolved 3')
    expect(formatted.parent).toContain('terminal incomplete 1')
    expect(formatted.parent).not.toContain('No qualified opinions')
    expect(formatted.parent).not.toContain('Concrete outcomes: none')
  })

  it('uses only privacy-safe attribution and deterministic parsed-opinion paraphrase', () => {
    const serialized = JSON.stringify(formatInverseAkitaTradeJournal(BASE))
    expect(serialized).toContain('@creator')
    expect(serialized).toContain('Expressed a bullish view on BTC.')
    expect(serialized).toContain('https://alfaclub.4626.fun/rooms?roomId=1484')
    expect(serialized).not.toContain('sourceExcerpt')
    expect(serialized).not.toContain('messageId=')
    expect(serialized).not.toContain('/messages/')
  })

  it('renders every executed lifecycle influence while rendering PnL once', () => {
    const reply = formatInverseAkitaTradeJournal({
      ...BASE,
      trades: [BASE.trades[0]],
    }).replies[0]
    expect(reply).toContain('@creator · Expressed a bullish view on BTC. · source room')
    expect(reply).toContain('open · 2026-07-12T10:00:00.000Z')
    expect(reply).toContain('0xcccc…cccc · Expressed a bearish view on BTC. · source room')
    expect(reply).toContain('add · 2026-07-13T11:00:00.000Z')
    expect(reply.match(/unrealized PnL/g)).toHaveLength(1)
  })

  it('accurately distinguishes system roles and uses only the static Cabals URL', () => {
    const text = formatInverseAkitaTradeJournal(BASE).parent
    expect(text).toContain('AlfaClub is the opinion and room-context record')
    expect(text).toContain('Hermit4626 analyzes')
    expect(text).toContain('InverseAKITA owns the counter-position strategy')
    expect(text).toContain('Virtuals ACP executes approved trades')
    expect(text).toContain('Hyperliquid is execution and PnL truth')
    expect(text).toContain('https://cabals.com/cabal/inverseakita')
    expect(text).toContain('community and wallet-level attribution')
    expect(text).not.toContain('Cabals stores')
  })

  it('shortens a wallet when no public label is available', () => {
    const formatted = formatInverseAkitaTradeJournal({
      ...BASE,
      trades: [{
        ...BASE.trades[0],
        attribution: {
          label: '0xbbbb…bbbb',
          roomId: '1659',
          paraphrase: 'Expressed a bearish view on ETH.',
          influences: [],
        },
      }],
    })
    expect(formatted.replies.join('\n')).toContain('0xbbbb…bbbb')
    expect(formatted.replies.join('\n')).not.toContain(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    )
  })

  it.each([
    'safe [click](https://evil.test/private/message/77)',
    '../../private/messages/77',
    'https://evil.test/private/message/77',
    'name\u0000with-control',
    '> quoted\n@operator',
  ])('sanitizes hostile public label %j from the complete rendered bundle', (hostileLabel) => {
    const wallet = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const label = sanitizeInverseAkitaPublicLabel(hostileLabel, wallet)
    const serialized = JSON.stringify(formatInverseAkitaTradeJournal({
      ...BASE,
      trades: [{
        ...BASE.trades[0],
        attribution: {
          ...BASE.trades[0].attribution,
          label,
          influences: BASE.trades[0].attribution.influences.map((influence) => ({
            ...influence,
            label,
          })),
        },
      }],
    }))
    expect(serialized).toContain('0xaaaa…aaaa')
    expect(serialized).not.toContain(hostileLabel)
    expect(serialized).not.toContain('evil.test')
    expect(serialized).not.toContain('/private/')
  })
})
