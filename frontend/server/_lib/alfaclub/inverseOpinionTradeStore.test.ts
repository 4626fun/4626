import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const ensureSchemaMock = vi.fn(async () => {})
const loggerErrorMock = vi.fn()

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureAlfaclubInverseOpinionTradeSchema: ensureSchemaMock,
}))

vi.mock('../infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
    debug: vi.fn(),
  },
}))

const SOURCE = {
  roomId: '1484',
  messageId: 'message-77',
  sourceHash: 'a'.repeat(64),
  excerpt: 'BTC looks overextended after the squeeze.',
  senderAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  publicAuthorLabel: '@creator',
  sourceTimestamp: '2026-07-14T08:00:00.000Z',
}

const DECISION_ROW = {
  decision_id: '11111111-1111-4111-8111-111111111111',
  source_message_id: '22222222-2222-4222-8222-222222222222',
  intent_ordinal: 0,
  normalized_market: 'BTC',
  source_side: 'long',
  inverse_side: 'short',
  execution_phase: 'claimed',
  terminal_outcome: null,
  reason_code: null,
  executor_wallet: null,
  requested_parameters: {},
  receipt_summary: {},
  attribution_quality: 'complete',
  observed_at: SOURCE.sourceTimestamp,
  updated_at: SOURCE.sourceTimestamp,
}

function sqlText(strings: TemplateStringsArray): string {
  return strings.join(' ')
}

describe('inverseOpinionTradeStore', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getDbMock.mockReset()
    ensureSchemaMock.mockResolvedValue(undefined)
  })

  it('idempotently returns the same decision for a duplicate source and intent', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      expect(sqlText(strings)).toContain('ON CONFLICT (room_id, message_id)')
      expect(sqlText(strings)).toContain(
        'ON CONFLICT (source_message_id, intent_ordinal, normalized_market)',
      )
      return { rows: [DECISION_ROW], rowCount: 1 }
    })
    getDbMock.mockResolvedValue({ sql })

    const { claimOpinionIntent } = await import('./inverseOpinionTradeStore.js')
    const params = {
      source: SOURCE,
      intent: {
        ordinal: 0,
        normalizedMarket: 'btc',
        sourceSide: 'long' as const,
        inverseSide: 'short' as const,
        attributionQuality: 'complete' as const,
      },
    }

    const first = await claimOpinionIntent(params)
    const duplicate = await claimOpinionIntent(params)

    expect(first).toEqual(duplicate)
    expect(first?.decisionId).toBe(DECISION_ROW.decision_id)
    expect(ensureSchemaMock).toHaveBeenCalledTimes(2)
  })

  it('persists multiple deterministic intents from one deduplicated source message', async () => {
    const rows = [
      DECISION_ROW,
      {
        ...DECISION_ROW,
        decision_id: '33333333-3333-4333-8333-333333333333',
        intent_ordinal: 1,
        normalized_market: 'ETH',
      },
    ]
    const sql = vi.fn(async () => ({ rows: [rows.shift()], rowCount: 1 }))
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionIntent } = await import('./inverseOpinionTradeStore.js')

    const btc = await claimOpinionIntent({
      source: SOURCE,
      intent: {
        ordinal: 0,
        normalizedMarket: 'BTC',
        sourceSide: 'long',
        inverseSide: 'short',
        attributionQuality: 'complete',
      },
    })
    const eth = await claimOpinionIntent({
      source: SOURCE,
      intent: {
        ordinal: 1,
        normalizedMarket: 'ETH',
        sourceSide: 'long',
        inverseSide: 'short',
        attributionQuality: 'complete',
      },
    })

    expect([btc?.normalizedMarket, eth?.normalizedMarket]).toEqual(['BTC', 'ETH'])
    expect(btc?.sourceMessageId).toBe(eth?.sourceMessageId)
  })

  it('keeps execution phase separate from terminal outcome and rejects illegal transitions', async () => {
    const sql = vi.fn(async () => ({
      rows: [{ ...DECISION_ROW, execution_phase: 'submitted' }],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })
    const {
      isLegalDecisionTransition,
      isLegalLifecycleTransition,
      transitionOpinionDecision,
    } = await import('./inverseOpinionTradeStore.js')

    expect(isLegalDecisionTransition('claimed', 'submitted', null)).toBe(true)
    expect(isLegalDecisionTransition('submitted', 'resolved', 'executed')).toBe(true)
    expect(isLegalDecisionTransition('claimed', 'resolved', 'rejected')).toBe(true)
    expect(isLegalDecisionTransition('claimed', 'resolved', null)).toBe(false)
    expect(isLegalDecisionTransition('claimed', 'submitted', 'executed')).toBe(false)
    expect(isLegalDecisionTransition('resolved', 'submitted', null)).toBe(false)
    expect(isLegalLifecycleTransition('pending', 'open')).toBe(true)
    expect(isLegalLifecycleTransition('open', 'closed')).toBe(true)
    expect(isLegalLifecycleTransition('closed', 'open')).toBe(false)

    await expect(
      transitionOpinionDecision({
        decisionId: DECISION_ROW.decision_id,
        executionPhase: 'submitted',
        terminalOutcome: 'executed',
      }),
    ).rejects.toMatchObject({ code: 'invalid_transition' })
    expect(sql).not.toHaveBeenCalled()
  })

  it('casts nullable transition params so Postgres can type null terminal outcomes', async () => {
    const sql = vi.fn(async () => ({
      rows: [{ ...DECISION_ROW, execution_phase: 'submitted', terminal_outcome: null }],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })
    const { transitionOpinionDecision } = await import('./inverseOpinionTradeStore.js')

    await transitionOpinionDecision({
      decisionId: DECISION_ROW.decision_id,
      executionPhase: 'submitted',
      terminalOutcome: null,
      executionClaimToken: '11111111-1111-4111-8111-111111111111',
    })

    expect(sql).toHaveBeenCalledTimes(1)
    const strings = (sql.mock.calls as unknown as Array<[TemplateStringsArray]>)[0]?.[0]
    expect(strings).toBeDefined()
    if (!strings) return
    const joined = Array.from(strings).join('?')
    expect(joined).toContain('terminal_outcome = ?::text')
    expect(joined).toContain('reason_code = ?::text')
    expect(joined).toContain('::text IS NULL')
    expect(joined).toContain('execution_claim_token = ?::uuid')
  })

  it('opens one lifecycle and appends later add/trim influence events', async () => {
    const lifecycleRow = {
      lifecycle_id: '44444444-4444-4444-8444-444444444444',
      executor_wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      normalized_market: 'BTC',
      side: 'short',
      opening_decision_id: DECISION_ROW.decision_id,
      lifecycle_state: 'open',
      attribution_quality: 'complete',
      reconciliation_generation: 1,
      opened_at: '2026-07-14T08:05:00.000Z',
      closed_at: null,
      last_reconciled_at: '2026-07-14T08:05:00.000Z',
      current_snapshot: {},
      realized_result: {},
      created_at: '2026-07-14T08:05:00.000Z',
      updated_at: '2026-07-14T08:05:00.000Z',
    }
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('INSERT INTO alfaclub.inverse_position_lifecycles')) {
        return { rows: [lifecycleRow], rowCount: 1 }
      }
      if (text.includes('INSERT INTO alfaclub.inverse_position_lifecycle_events')) {
        return {
          rows: [{
            event_id: '55555555-5555-4555-8555-555555555555',
            lifecycle_id: lifecycleRow.lifecycle_id,
            decision_id: '33333333-3333-4333-8333-333333333333',
            event_key: 'decision:add:3333',
            event_type: 'add',
            evidence_layer: 'observed',
            analysis_verdict: null,
            event_payload: {},
            occurred_at: '2026-07-14T09:00:00.000Z',
            created_at: '2026-07-14T09:00:00.000Z',
          }],
          rowCount: 1,
        }
      }
      return { rows: [], rowCount: 0 }
    })
    getDbMock.mockResolvedValue({ sql })
    const { appendPositionLifecycleEvent, openPositionLifecycle } = await import(
      './inverseOpinionTradeStore.js'
    )

    const lifecycle = await openPositionLifecycle({
      openingDecisionId: DECISION_ROW.decision_id,
      executorWallet: lifecycleRow.executor_wallet,
      normalizedMarket: 'BTC',
      side: 'short',
      lifecycleState: 'open',
      attributionQuality: 'complete',
    })
    const influence = await appendPositionLifecycleEvent({
      lifecycleId: lifecycle.lifecycleId,
      decisionId: '33333333-3333-4333-8333-333333333333',
      eventKey: 'decision:add:3333',
      eventType: 'add',
      evidenceLayer: 'observed',
      occurredAt: '2026-07-14T09:00:00.000Z',
    })

    expect(lifecycle.openingDecisionId).toBe(DECISION_ROW.decision_id)
    expect(influence.eventType).toBe('add')
    expect(influence.decisionId).not.toBe(lifecycle.openingDecisionId)
  })

  it('surfaces a redacted unique-open-lifecycle failure', async () => {
    const rawSource = 'secret source text that must never be logged'
    const credential = 'postgres://operator:password@example.test/db'
    const dbError = Object.assign(
      new Error(`duplicate key ${rawSource} ${credential}`),
      {
        code: '23505',
        constraint: 'inverse_position_lifecycles_one_open_idx',
        detail: `Key source_excerpt=(${rawSource})`,
      },
    )
    getDbMock.mockResolvedValue({
      sql: vi.fn(async () => {
        throw dbError
      }),
    })
    const { openPositionLifecycle } = await import('./inverseOpinionTradeStore.js')

    await expect(
      openPositionLifecycle({
        openingDecisionId: DECISION_ROW.decision_id,
        executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        normalizedMarket: 'BTC',
        side: 'short',
        lifecycleState: 'open',
        attributionQuality: 'complete',
      }),
    ).rejects.toMatchObject({ code: 'open_lifecycle_conflict' })

    const serialized = JSON.stringify(loggerErrorMock.mock.calls)
    expect(serialized).not.toContain(rawSource)
    expect(serialized).not.toContain(credential)
    expect(serialized).toContain('23505')
    expect(serialized).toContain('inverse_position_lifecycles_one_open_idx')
  })

  it('queries all open lifecycles independently of source and dispatch windows', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('l.closed_at IS NULL')
      expect(text).toContain('l.closed_at >=')
      expect(text).not.toContain('dispatch')
      return { rows: [], rowCount: 0 }
    })
    getDbMock.mockResolvedValue({ sql })
    const { listPositionLifecyclesForJournal } = await import('./inverseOpinionTradeStore.js')

    await expect(
      listPositionLifecyclesForJournal({
        windowStart: '2026-07-13T08:00:00.000Z',
        windowEnd: '2026-07-14T08:00:00.000Z',
      }),
    ).resolves.toEqual([])
  })
})

describe('inverse opinion trade lifecycle migration', () => {
  it('enforces privacy, vocabulary, restrictive references, and one open lifecycle', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717000000_alfaclub_inverse_opinion_trade_lifecycle.sql',
      ),
      'utf8',
    )

    expect(migration).toContain('UNIQUE (room_id, message_id)')
    expect(migration).toContain('source_excerpt VARCHAR(500)')
    expect(migration).not.toMatch(/\bsource_(?:text|body|content)\b/i)
    expect(migration).toContain(
      'UNIQUE (source_message_id, intent_ordinal, normalized_market)',
    )
    expect(migration).toContain('inverse_position_lifecycles_one_open_idx')
    expect(migration).toContain('WHERE closed_at IS NULL')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(migration).toContain("'observed', 'claimed', 'submitted', 'resolved', 'unknown'")
    expect(migration).toContain("'executed', 'rejected', 'blocked', 'failed', 'incomplete'")
    expect(migration).toContain("'pending', 'partial', 'open', 'closed', 'ambiguous', 'incomplete'")
    expect(migration).toContain("'complete', 'partial', 'unknown'")
    expect(migration).toContain("'observed', 'derived', 'interpretation'")
    expect(migration).toContain("'hold', 'add', 'trim', 'exit', 'watch'")
    expect(migration.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(4)
    expect(migration.match(/REVOKE ALL ON TABLE alfaclub\.inverse_/g)).toHaveLength(4)
    expect(migration.match(/GRANT ALL ON TABLE alfaclub\.inverse_/g)).toHaveLength(4)
  })
})
