import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getDbMock = vi.fn()
const ensureSchemaMock = vi.fn(async () => {})
const loggerErrorMock = vi.fn()

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  runInTransaction: vi.fn(async (fn) => fn(await getDbMock())),
}))

vi.mock('../../server/_lib/db/schemaBootstrap.js', () => ({
  ensureAlfaclubInverseOpinionTradeSchema: ensureSchemaMock,
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
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

    const { claimOpinionIntent } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
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

  it('leases a decision to one worker and only reclaims after lease expiry', async () => {
    let decisionInsertCalls = 0
    const claimedRow = {
      ...DECISION_ROW,
      execution_claim_token: '66666666-6666-4666-8666-666666666666',
      execution_claim_expires_at: '2026-07-14T08:05:00.000Z',
      execution_attempt_count: 1,
      recovery_attempt_count: 0,
      recovery_last_checked_at: null,
      recovery_deadline_at: null,
      execution_claimed: true,
    }
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('INSERT INTO alfaclub.inverse_opinion_trade_decisions')) {
        decisionInsertCalls += 1
        expect(text).toContain("execution_phase = 'claimed'")
        expect(text).toContain('execution_claim_expires_at <= NOW()')
        if (decisionInsertCalls === 2) return { rows: [] }
        return {
          rows: [{
            ...claimedRow,
            execution_attempt_count: decisionInsertCalls,
          }],
        }
      }
      expect(text).toContain('FALSE AS execution_claimed')
      return {
        rows: [{
          ...claimedRow,
          execution_claim_token: null,
          execution_claimed: false,
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionIntent } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    const params = {
      source: SOURCE,
      intent: {
        ordinal: 0,
        normalizedMarket: 'BTC',
        sourceSide: 'long' as const,
        inverseSide: 'short' as const,
        attributionQuality: 'complete' as const,
      },
    }

    await expect(claimOpinionIntent(params)).resolves.toMatchObject({ executionClaimed: true })
    await expect(claimOpinionIntent(params)).resolves.toMatchObject({
      executionClaimed: false,
      executionClaimToken: null,
    })
    await expect(claimOpinionIntent(params)).resolves.toMatchObject({
      executionClaimed: true,
      executionAttemptCount: 3,
    })
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
    const { claimOpinionIntent } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

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
    } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    expect(isLegalDecisionTransition('claimed', 'submitted', null)).toBe(true)
    expect(isLegalDecisionTransition('submitted', 'submitted', null)).toBe(false)
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

  it('makes claimed-to-submitted a token-bound one-shot compare-and-swap', async () => {
    let submitted = false
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = sqlText(strings)
      expect(text).toContain('execution_claim_token =')
      expect(text).toContain("execution_phase = 'claimed'")
      expect(text).not.toContain('execution_phase = ${params.executionPhase}')
      if (submitted) return { rows: [], rowCount: 0 }
      submitted = true
      return {
        rows: [{
          ...DECISION_ROW,
          execution_phase: 'submitted',
          submitted_at: SOURCE.sourceTimestamp,
          execution_claim_token: null,
          execution_claim_expires_at: null,
          execution_attempt_count: 1,
          recovery_attempt_count: 0,
          recovery_last_checked_at: null,
          recovery_deadline_at: null,
        }],
        rowCount: 1,
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { transitionOpinionDecision } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    const params = {
      decisionId: DECISION_ROW.decision_id,
      executionPhase: 'submitted' as const,
      executionClaimToken: '66666666-6666-4666-8666-666666666666',
    }

    await expect(transitionOpinionDecision(params)).resolves.toMatchObject({
      executionPhase: 'submitted',
    })
    await expect(transitionOpinionDecision(params)).rejects.toMatchObject({
      code: 'invalid_transition',
    })
  })

  it('keeps the first terminal receipt immutable on idempotent terminal retries', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain("WHEN execution_phase = 'resolved' THEN receipt_summary")
      return {
        rows: [{
          ...DECISION_ROW,
          execution_phase: 'resolved',
          terminal_outcome: 'executed',
          receipt_summary: {
            terminalReply: {
              ok: true,
              replyText: 'first immutable result',
              threadReceiptText: 'first immutable receipt',
              reactionEmoji: '🔄',
              counterSide: 'short',
              pair: 'BTC',
            },
          },
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { transitionOpinionDecision } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(transitionOpinionDecision({
      decisionId: DECISION_ROW.decision_id,
      executionPhase: 'resolved',
      terminalOutcome: 'executed',
      reasonCode: 'arena_execution_succeeded',
      receiptSummary: {
        terminalReply: { replyText: 'later overwrite attempt' },
      },
    })).resolves.toMatchObject({
      receiptSummary: {
        terminalReply: { replyText: 'first immutable result' },
      },
    })
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
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
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
    const { openPositionLifecycle } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

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
    const { listPositionLifecyclesForJournal } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    await expect(
      listPositionLifecyclesForJournal({
        windowStart: '2026-07-13T08:00:00.000Z',
        windowEnd: '2026-07-14T08:00:00.000Z',
      }),
    ).resolves.toEqual([])
  })

  it('queries every qualified journal decision in the reporting window without source excerpts', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('d.observed_at >=')
      expect(text).toContain('d.observed_at <')
      expect(text).toContain('d.execution_phase')
      expect(text).not.toContain('d.terminal_outcome IS NOT NULL')
      expect(text).toContain('s.public_author_label')
      expect(text).not.toContain('source_excerpt')
      return {
        rows: [{
          decision_id: DECISION_ROW.decision_id,
          execution_phase: 'claimed',
          terminal_outcome: null,
          reason_code: 'risk_limit',
          normalized_market: 'BTC',
          source_side: 'long',
          inverse_side: 'short',
          room_id: '1484',
          public_author_label: '@creator',
          sender_address: SOURCE.senderAddress,
          source_timestamp: SOURCE.sourceTimestamp,
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { listOpinionTradeJournalDecisions } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
    await expect(listOpinionTradeJournalDecisions({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
    })).resolves.toEqual([
      expect.objectContaining({
        executionPhase: 'claimed',
        terminalOutcome: null,
        reasonCode: 'risk_limit',
      }),
    ])
  })

  it('atomically claims a journal window and never reclaims sent or send_unknown states', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('WITH expired AS')) {
        expect(text).toContain("THEN 'send_unknown'")
        expect(text).toContain("ELSE 'failed'")
        return { rows: [] }
      }
      expect(text).toContain('ON CONFLICT (room_id, reporting_window_start, reporting_window_end)')
      expect(text).toContain("dispatch_state = 'failed'")
      expect(text).toContain("dispatch_state = 'claimed'")
      expect(text).not.toContain("dispatch_state = 'send_unknown'")
      expect(text).not.toContain("dispatch_state = 'sent'")
      return {
        rows: [{
          dispatch_id: '77777777-7777-4777-8777-777777777777',
          room_id: '1659',
          reporting_window_start: '2026-07-13T12:10:00.000Z',
          reporting_window_end: '2026-07-14T12:10:00.000Z',
          dispatch_state: 'claimed',
          claimant_token: '66666666-6666-4666-8666-666666666666',
          client_message_id: 'inverse-akita-journal:stable:parent',
          parent_message_id: null,
          attempt_count: 1,
          analysis_revision: 0,
          won: true,
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionTradeJournalDispatch } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
    await expect(claimOpinionTradeJournalDispatch({
      roomId: '1659',
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      claimantToken: '66666666-6666-4666-8666-666666666666',
      leaseSeconds: 300,
      clientMessageId: 'inverse-akita-journal:stable:parent',
    })).resolves.toMatchObject({ won: true, dispatch: { roomId: '1659', attemptCount: 1 } })
  })

  it('returns the existing dispatch as a losing claim even when the claimant token matches', async () => {
    const row = {
      dispatch_id: '77777777-7777-4777-8777-777777777777',
      room_id: '1659',
      reporting_window_start: '2026-07-13T12:10:00.000Z',
      reporting_window_end: '2026-07-14T12:10:00.000Z',
      dispatch_state: 'sent',
      claimant_token: '66666666-6666-4666-8666-666666666666',
      client_message_id: 'inverse-akita-journal:stable:parent',
      parent_message_id: 'parent-1',
      attempt_count: 1,
      analysis_revision: 0,
    }
    const sql = vi.fn(async (strings: TemplateStringsArray) => (
      sqlText(strings).includes('INSERT INTO')
        ? { rows: [] }
        : { rows: [row] }
    ))
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionTradeJournalDispatch } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
    await expect(claimOpinionTradeJournalDispatch({
      roomId: '1659',
      windowStart: row.reporting_window_start,
      windowEnd: row.reporting_window_end,
      claimantToken: row.claimant_token,
      leaseSeconds: 300,
      clientMessageId: row.client_message_id,
    })).resolves.toMatchObject({
      won: false,
      dispatch: { state: 'sent', parentMessageId: 'parent-1' },
    })
  })

  it('reads stale submitted, unknown, executed, and incomplete decisions still needing reconciliation', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain("d.execution_phase = 'unknown'")
      expect(text).toContain("d.execution_phase = 'submitted'")
      expect(text).toContain('d.recovery_deadline_at <= NOW()')
      expect(text).toContain("d.terminal_outcome = 'executed'")
      expect(text).toContain("d.terminal_outcome = 'incomplete'")
      expect(text).toContain("l.lifecycle_state NOT IN ('closed', 'incomplete')")
      expect(text).toContain("l.lifecycle_state = 'closed'")
      expect(text).toContain("CASE WHEN d.receipt_summary ? 'fill' THEN 0 ELSE 1 END ASC")
      expect(text).toContain('COALESCE(d.submitted_at, d.observed_at) ASC')
      expect(text).toContain('d.decision_id ASC')
      return { rows: [{ ...DECISION_ROW, submitted_at: null, resolved_at: null }], rowCount: 1 }
    })
    getDbMock.mockResolvedValue({ sql })
    const { listOpinionDecisionsForReconciliation } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(listOpinionDecisionsForReconciliation({ limit: 25 })).resolves.toEqual([
      expect.objectContaining({ decisionId: DECISION_ROW.decision_id }),
    ])
  })

  it('finds unresolved lifecycle identity and does not fake closure for incomplete attribution', async () => {
    const lifecycleRow = {
      lifecycle_id: '44444444-4444-4444-8444-444444444444',
      executor_wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      normalized_market: 'BTC',
      side: 'short',
      opening_decision_id: DECISION_ROW.decision_id,
      lifecycle_state: 'incomplete',
      attribution_quality: 'partial',
      reconciliation_generation: 3,
      opened_at: '2026-07-14T08:05:00.000Z',
      closed_at: null,
      last_reconciled_at: '2026-07-14T09:05:00.000Z',
      current_snapshot: { evidenceStatus: 'incomplete' },
      realized_result: {},
      created_at: '2026-07-14T08:05:00.000Z',
      updated_at: '2026-07-14T09:05:00.000Z',
    }
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('SELECT') && text.includes('executor_wallet =')) {
        expect(text).toContain('closed_at IS NULL')
        return { rows: [lifecycleRow], rowCount: 1 }
      }
      expect(text).toContain("lifecycle_state = 'ambiguous'")
      expect(text).toContain("'incomplete'")
      expect(text).toContain("WHEN attribution_quality = 'complete' THEN 'complete'")
      return { rows: [lifecycleRow], rowCount: 1 }
    })
    getDbMock.mockResolvedValue({ sql })
    const { findOpenPositionLifecycle, transitionPositionLifecycle } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(findOpenPositionLifecycle({
      executorWallet: lifecycleRow.executor_wallet,
      normalizedMarket: 'BTC',
      side: 'short',
    })).resolves.toMatchObject({ lifecycleState: 'incomplete', closedAt: null })
    await expect(transitionPositionLifecycle({
      lifecycleId: lifecycleRow.lifecycle_id,
      lifecycleState: 'incomplete',
      expectedReconciliationGeneration: 3,
      reconciledAt: '2026-07-14T09:05:00.000Z',
      closedAt: null,
    })).resolves.toMatchObject({ lifecycleState: 'incomplete', closedAt: null })
  })

  it('increments lifecycle generation only from the expected generation', async () => {
    const lifecycleRow = {
      lifecycle_id: '44444444-4444-4444-8444-444444444444',
      executor_wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      normalized_market: 'BTC',
      side: 'short',
      opening_decision_id: DECISION_ROW.decision_id,
      lifecycle_state: 'open',
      attribution_quality: 'complete',
      reconciliation_generation: 5,
      opened_at: SOURCE.sourceTimestamp,
      closed_at: null,
      last_reconciled_at: SOURCE.sourceTimestamp,
      current_snapshot: {},
      realized_result: {},
      created_at: SOURCE.sourceTimestamp,
      updated_at: SOURCE.sourceTimestamp,
    }
    let won = false
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('reconciliation_generation = reconciliation_generation + 1')
      expect(text).toContain('reconciliation_generation =')
      expect(text).not.toContain('reconciliation_generation <=')
      if (won) return { rows: [] }
      won = true
      return { rows: [lifecycleRow] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { transitionPositionLifecycle } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    const params = {
      lifecycleId: lifecycleRow.lifecycle_id,
      lifecycleState: 'open' as const,
      expectedReconciliationGeneration: 4,
      reconciledAt: SOURCE.sourceTimestamp,
      closedAt: null,
    }
    await expect(transitionPositionLifecycle(params)).resolves.toMatchObject({
      reconciliationGeneration: 5,
    })
    await expect(transitionPositionLifecycle(params)).rejects.toMatchObject({
      code: 'reconciliation_conflict',
    })
  })

  it('claims one executor fill identity for only one decision', async () => {
    let claimed = false
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('inverse_opinion_fill_claims')
      expect(text).toContain('ON CONFLICT (executor_wallet, fill_identity) DO UPDATE')
      expect(text).toContain('RETURNING decision_id =')
      if (claimed) return { rows: [{ owned: false }] }
      claimed = true
      return { rows: [{ owned: true }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionFillIdentity } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    const params = {
      decisionId: DECISION_ROW.decision_id,
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      fillIdentity: 'fill-nearby-1',
    }
    await expect(claimOpinionFillIdentity(params)).resolves.toBe(true)
    await expect(claimOpinionFillIdentity({
      ...params,
      decisionId: '33333333-3333-4333-8333-333333333333',
    })).resolves.toBe(false)
  })

  it('claims a split-fill identity set atomically or claims none', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = sqlText(strings)
      if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('SELECT fill_identity, decision_id')) return { rows: [] }
      expect(text).toContain('INSERT INTO alfaclub.inverse_opinion_fill_claims')
      expect(text).toContain('jsonb_array_elements_text')
      expect(text).toContain('ON CONFLICT (executor_wallet, fill_identity) DO NOTHING')
      expect(values).toContain(JSON.stringify(['split-a', 'split-b']))
      return { rows: [{ fill_identity: 'split-a' }, { fill_identity: 'split-b' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionFillIdentities } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(claimOpinionFillIdentities({
      decisionId: DECISION_ROW.decision_id,
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      fillIdentities: ['split-a', 'split-b'],
    })).resolves.toBe(true)
  })

  it('does not claim any split constituent when one identity belongs to another decision', async () => {
    let insertCalls = 0
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('SELECT fill_identity, decision_id')) {
        return {
          rows: [{
            fill_identity: 'split-b',
            decision_id: '33333333-3333-4333-8333-333333333333',
          }],
        }
      }
      insertCalls += 1
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionFillIdentities } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(claimOpinionFillIdentities({
      decisionId: DECISION_ROW.decision_id,
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      fillIdentities: ['split-a', 'split-b'],
    })).resolves.toBe(false)
    expect(insertCalls).toBe(0)
  })

  it('reserves unowned ambiguous candidates without overwriting a foreign fill claim', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = sqlText(strings)
      if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('SELECT fill_identity, decision_id')) {
        return {
          rows: [{
            fill_identity: 'ambiguous-b',
            decision_id: '33333333-3333-4333-8333-333333333333',
          }],
        }
      }
      expect(text).toContain('INSERT INTO alfaclub.inverse_opinion_fill_claims')
      expect(text).toContain('ON CONFLICT (executor_wallet, fill_identity) DO NOTHING')
      expect(values).toContain(JSON.stringify(['ambiguous-a', 'ambiguous-b']))
      return { rows: [{ fill_identity: 'ambiguous-a' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { reserveOpinionFillIdentities } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(reserveOpinionFillIdentities({
      decisionId: DECISION_ROW.decision_id,
      executorWallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      fillIdentities: ['ambiguous-a', 'ambiguous-b'],
    })).resolves.toBe(false)
    expect(sql).toHaveBeenCalledTimes(3)
  })

  it('blocks a new revision while a requested or send_unknown revision is unresolved', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('inverse_opinion_trade_journal_revision_audit')
      expect(text).toContain("audit_state IN ('requested', 'send_unknown')")
      return { rows: [{ revision: -1, client_message_id: '' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { beginOpinionTradeJournalRevision } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(beginOpinionTradeJournalRevision({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      clientMessageIdPrefix: 'inverse-akita-journal:stable:revision',
    })).rejects.toMatchObject({ code: 'journal_revision_unresolved' })
  })

  it('reclaims an expired requested revision with the same immutable text and client id', async () => {
    const immutableText = '<!-- inverse-akita-trade-journal:v1 -->\nimmutable revision'
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain("audit.audit_state = 'requested'")
      expect(text).toContain('audit.lease_expires_at <= NOW()')
      expect(text).toContain('audit.public_text')
      expect(text).toContain('audit.client_message_id')
      expect(text).toContain("audit_state = 'send_unknown'")
      expect(text).toContain("last_error_code = 'revision_sending_lease_expired'")
      expect(text).toContain('audit.send_started_at IS NOT NULL')
      expect(text).toContain('audit.send_started_at IS NULL')
      expect(text).not.toContain('analysis_revision = analysis_revision + 1')
      return {
        rows: [{
          revision: 2,
          client_message_id: 'inverse-akita-journal:stable:revision:2',
          public_text: immutableText,
          claimant_token: '77777777-7777-4777-8777-777777777777',
          recovered: true,
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { beginOpinionTradeJournalRevision } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(beginOpinionTradeJournalRevision({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      clientMessageIdPrefix: 'inverse-akita-journal:stable:revision',
      claimantToken: '77777777-7777-4777-8777-777777777777',
      leaseSeconds: 300,
      publicText: null,
    })).resolves.toEqual({
      revision: 2,
      clientMessageId: 'inverse-akita-journal:stable:revision:2',
      publicText: immutableText,
      claimantToken: '77777777-7777-4777-8777-777777777777',
      recovered: true,
    })
  })

  it('resolves only a targeted revision send_unknown with explicit operator evidence', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('inverse_opinion_trade_journal_revision_audit')
      expect(text).toContain("audit_state = 'send_unknown'")
      expect(text).toContain('resolution_operator_address')
      expect(text).toContain('resolution_note')
      expect(text).toContain('resolved_at')
      expect(text).toContain('reply_message_id')
      expect(text).toContain('content_hash')
      return { rows: [{ audit_id: 'audit-2' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { resolveOpinionTradeJournalRevisionSendUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(resolveOpinionTradeJournalRevisionSendUnknown({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      revision: 2,
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolution: 'mark_sent',
      knownMessageId: 'revision-message-2',
      knownContentHash: 'a'.repeat(64),
      note: 'Confirmed in AlfaClub message history.',
    })).resolves.toBeUndefined()
  })

  it('safely transitions only a pending revision to send_unknown after a confirmed send', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain("audit_state = 'send_unknown'")
      expect(text).toContain("audit.audit_state = 'requested'")
      expect(text).toContain('reply_message_id =')
      expect(text).toContain('content_hash =')
      expect(text).toContain('last_error_code =')
      return { rows: [{ audit_id: 'audit-1' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { recoverOpinionTradeJournalRevisionSendUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(recoverOpinionTradeJournalRevisionSendUnknown({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      revision: 2,
      claimantToken: '77777777-7777-4777-8777-777777777777',
      replyMessageId: 'revision-message-2',
      contentHash: 'a'.repeat(64),
      errorCode: 'journal_revision_sent_record_unknown',
    })).resolves.toBeUndefined()
  })

  it('records bounded unknown recovery checks and terminal incomplete expiry', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('recovery_attempt_count = recovery_attempt_count + 1')
      expect(text).toContain('recovery_last_checked_at')
      expect(text).toContain("THEN 'incomplete'")
      return {
        rows: [{
          ...DECISION_ROW,
          execution_phase: 'resolved',
          terminal_outcome: 'incomplete',
          reason_code: 'execution_evidence_window_expired',
          submitted_at: SOURCE.sourceTimestamp,
          resolved_at: '2026-07-14T08:30:00.000Z',
          execution_attempt_count: 1,
          recovery_attempt_count: 3,
          recovery_last_checked_at: '2026-07-14T08:30:00.000Z',
          recovery_deadline_at: '2026-07-14T08:20:00.000Z',
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { recordUnknownReconciliationCheck } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    await expect(recordUnknownReconciliationCheck({
      decisionId: DECISION_ROW.decision_id,
      checkedAt: '2026-07-14T08:30:00.000Z',
    })).resolves.toMatchObject({
      expired: true,
      decision: {
        terminalOutcome: 'incomplete',
        recoveryAttemptCount: 3,
      },
    })
  })

  it('queries journal source facts without selecting source excerpt or display attribution', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).not.toContain('source_excerpt')
      expect(text).not.toContain('public_author_label')
      expect(text).toContain('(d.requested_parameters || d.receipt_summary)')
      return {
        rows: [{
          lifecycle_id: '44444444-4444-4444-8444-444444444444',
          decision_id: DECISION_ROW.decision_id,
          room_id: SOURCE.roomId,
          source_message_id: DECISION_ROW.source_message_id,
          source_hash: SOURCE.sourceHash,
          source_timestamp: SOURCE.sourceTimestamp,
          source_side: 'long',
          inverse_side: 'short',
          normalized_market: 'BTC',
          decision_metadata: {
            authorAccess: { eligible: true, reason: 'owner', stakedKeys: null },
          },
        }],
        rowCount: 1,
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { getOpinionTradeJournalSource } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    await expect(
      getOpinionTradeJournalSource('44444444-4444-4444-8444-444444444444'),
    ).resolves.toMatchObject({
      roomId: '1484',
      decisionMetadata: {
        authorAccess: { eligible: true, reason: 'owner', stakedKeys: null },
      },
    })
  })

  it('queries every executed lifecycle influence through events, decisions, and source messages', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('inverse_position_lifecycle_events')
      expect(text).toContain('inverse_opinion_trade_decisions')
      expect(text).toContain('inverse_opinion_source_messages')
      expect(text).toContain("d.terminal_outcome = 'executed'")
      expect(text).not.toContain('source_excerpt')
      return {
        rows: [{
          decision_id: DECISION_ROW.decision_id,
          room_id: SOURCE.roomId,
          public_author_label: '@creator',
          sender_address: SOURCE.senderAddress,
          source_side: 'long',
          normalized_market: 'BTC',
          action: 'open',
          occurred_at: SOURCE.sourceTimestamp,
        }, {
          decision_id: '33333333-3333-4333-8333-333333333333',
          room_id: '1043',
          public_author_label: null,
          sender_address: '0xcccccccccccccccccccccccccccccccccccccccc',
          source_side: 'short',
          normalized_market: 'BTC',
          action: 'add',
          occurred_at: '2026-07-14T09:00:00.000Z',
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { listOpinionTradeJournalInfluences } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    await expect(listOpinionTradeJournalInfluences(
      '44444444-4444-4444-8444-444444444444',
    )).resolves.toEqual([
      expect.objectContaining({ action: 'open', publicAuthorLabel: '@creator' }),
      expect.objectContaining({ action: 'add', roomId: '1043' }),
    ])
  })

  it('expires a sending dispatch into send_unknown and never reclaims it blindly', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('WITH expired AS')) {
        expect(text).toContain("dispatch.dispatch_state = 'sending'")
        expect(text).toContain("THEN 'send_unknown'")
        expect(text).toContain("ELSE 'failed'")
        expect(text).toContain("last_error_code = 'sending_lease_expired'")
        expect(text).toContain('inverse_opinion_trade_journal_deliveries')
        expect(text).toContain("delivery.delivery_state = 'sending'")
        expect(text).not.toContain("dispatch_state = 'sending'\n          AND alfaclub")
        return { rows: [] }
      }
      if (text.includes('INSERT INTO alfaclub.inverse_opinion_trade_journal_dispatch')) {
        return { rows: [] }
      }
      return {
        rows: [{
          dispatch_id: '77777777-7777-4777-8777-777777777777',
          room_id: '1659',
          reporting_window_start: '2026-07-13T12:10:00.000Z',
          reporting_window_end: '2026-07-14T12:10:00.000Z',
          dispatch_state: 'send_unknown',
          claimant_token: '55555555-5555-4555-8555-555555555555',
          client_message_id: 'inverse-akita-journal:stable:parent',
          parent_message_id: null,
          attempt_count: 1,
          analysis_revision: 0,
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { claimOpinionTradeJournalDispatch } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    await expect(claimOpinionTradeJournalDispatch({
      roomId: '1659',
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      claimantToken: '66666666-6666-4666-8666-666666666666',
      leaseSeconds: 300,
      clientMessageId: 'inverse-akita-journal:stable:parent',
    })).resolves.toMatchObject({
      won: false,
      dispatch: { state: 'send_unknown' },
    })
  })

  it('audits bounded explicit send_unknown operator resolution', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('inverse_opinion_trade_journal_resolution_audit')
      expect(text).toContain("dispatch_state = 'send_unknown'")
      expect(text).toContain('inverse_opinion_trade_journal_deliveries')
      expect(text).toContain("dispatch_state = 'failed'")
      expect(text).toContain("delivery.delivery_state = 'send_unknown'")
      expect(text).toContain('operator_address')
      return { rows: [{ dispatch_id: '77777777-7777-4777-8777-777777777777' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { resolveOpinionTradeJournalSendUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )
    await expect(resolveOpinionTradeJournalSendUnknown({
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolution: 'mark_sent',
      deliveryKind: 'parent',
      deliveryOrdinal: 0,
      knownMessageId: 'parent-confirmed',
      note: 'Confirmed from AlfaClub message history.',
    })).resolves.toBeUndefined()
  })

  it('persists deterministic delivery plans and records a parent without finalizing dispatch', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('INSERT INTO alfaclub.inverse_opinion_trade_journal_deliveries')) {
        expect(text).toContain('ON CONFLICT (dispatch_id, delivery_kind, delivery_ordinal) DO NOTHING')
        expect(text).toContain("dispatch_state IN ('claimed', 'sending')")
        expect(text).toContain('public_text')
        return { rows: [] }
      }
      if (text.includes('delivery.delivery_kind') && text.includes('ORDER BY')) {
        return {
          rows: [{
            delivery_kind: 'parent',
            delivery_ordinal: 0,
            delivery_state: 'pending',
            client_message_id: 'inverse-akita-journal:stable:parent',
            content_hash: 'a'.repeat(64),
            public_text: 'immutable parent',
            message_id: null,
          }, {
            delivery_kind: 'reply',
            delivery_ordinal: 0,
            delivery_state: 'pending',
            client_message_id: 'inverse-akita-journal:stable:parent:reply:0',
            content_hash: 'b'.repeat(64),
            public_text: 'immutable reply',
            message_id: null,
          }],
        }
      }
      if (text.includes("SET delivery_state = 'sending'")) {
        expect(text).toContain("delivery.delivery_state IN ('pending', 'failed')")
        expect(text).toContain("dispatch.dispatch_state = 'sending'")
        return { rows: [{ delivery_id: '88888888-8888-4888-8888-888888888888' }] }
      }
      expect(text).toContain("delivery.delivery_state IN ('pending', 'sending', 'failed')")
      expect(text).toContain("dispatch_state = 'sending'")
      expect(text).toContain('SET parent_message_id = CASE')
      expect(text).not.toContain("dispatch_state = 'sent'")
      return { rows: [{ dispatch_id: '77777777-7777-4777-8777-777777777777' }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const {
      prepareOpinionTradeJournalDeliveries,
      markOpinionTradeJournalDeliverySending,
      recordOpinionTradeJournalDeliverySent,
    } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')
    const base = {
      windowStart: '2026-07-13T12:10:00.000Z',
      windowEnd: '2026-07-14T12:10:00.000Z',
      claimantToken: '66666666-6666-4666-8666-666666666666',
    }
    await expect(prepareOpinionTradeJournalDeliveries({
      ...base,
      deliveries: [{
        kind: 'parent',
        ordinal: 0,
        clientMessageId: 'inverse-akita-journal:stable:parent',
        contentHash: 'a'.repeat(64),
        content: 'immutable parent',
      }, {
        kind: 'reply',
        ordinal: 0,
        clientMessageId: 'inverse-akita-journal:stable:parent:reply:0',
        contentHash: 'b'.repeat(64),
        content: 'immutable reply',
      }],
    })).resolves.toHaveLength(2)
    await expect(markOpinionTradeJournalDeliverySending({
      ...base,
      kind: 'parent',
      ordinal: 0,
    })).resolves.toBeUndefined()
    await expect(recordOpinionTradeJournalDeliverySent({
      ...base,
      kind: 'parent',
      ordinal: 0,
      messageId: 'parent-1',
    })).resolves.toBeUndefined()
  })

  it('enforces analysis_only at the journal analysis storage boundary', async () => {
    const sql = vi.fn()
    getDbMock.mockResolvedValue({ sql })
    const { persistOpinionTradeJournalAnalysis } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    await expect(persistOpinionTradeJournalAnalysis({
      lifecycleId: '44444444-4444-4444-8444-444444444444',
      reportingWindowStart: '2026-07-13T12:00:00.000Z',
      reportingWindowEnd: '2026-07-14T12:00:00.000Z',
      evidenceBundle: {},
      interpretation: {},
      verdict: 'watch',
      confidence: 0.1,
      evidenceRefs: [],
      invalidationCondition: 'No validated interpretation.',
      watchCondition: 'Wait for fresh evidence.',
      modelName: 'hermit',
      analysisOnly: false,
    } as never)).rejects.toMatchObject({ code: 'invalid_input' })
    expect(sql).not.toHaveBeenCalled()
  })

  it('persists an independent analysis snapshot without updating lifecycle facts', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain('INSERT INTO alfaclub.inverse_opinion_trade_analyses')
      expect(text).toContain('TRUE')
      expect(text).not.toContain('UPDATE alfaclub.inverse_position_lifecycles')
      return {
        rows: [{
          analysis_id: '55555555-5555-4555-8555-555555555555',
          lifecycle_id: '44444444-4444-4444-8444-444444444444',
          reporting_window_start: '2026-07-13T12:00:00.000Z',
          reporting_window_end: '2026-07-14T12:00:00.000Z',
          evidence_bundle: { analysisOnly: true },
          interpretation: { text: 'Wait for fresh evidence.' },
          verdict: 'watch',
          confidence: 0.1,
          evidence_refs: [],
          invalidation_condition: 'No validated interpretation.',
          watch_condition: 'Wait for fresh evidence.',
          closed_thesis_assessment: null,
          model_name: 'hermit',
          model_version: null,
          analysis_only: true,
          failure_reason: 'request_failed',
          created_at: '2026-07-14T12:01:00.000Z',
        }],
        rowCount: 1,
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const { persistOpinionTradeJournalAnalysis } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    await expect(persistOpinionTradeJournalAnalysis({
      lifecycleId: '44444444-4444-4444-8444-444444444444',
      reportingWindowStart: '2026-07-13T12:00:00.000Z',
      reportingWindowEnd: '2026-07-14T12:00:00.000Z',
      evidenceBundle: { analysisOnly: true },
      interpretation: { text: 'Wait for fresh evidence.' },
      verdict: 'watch',
      confidence: 0.1,
      evidenceRefs: [],
      invalidationCondition: 'No validated interpretation.',
      watchCondition: 'Wait for fresh evidence.',
      modelName: 'hermit',
      analysisOnly: true,
      failureReason: 'request_failed',
    })).resolves.toMatchObject({
      analysisOnly: true,
      verdict: 'watch',
      failureReason: 'request_failed',
    })
  })
})

describe('inverse opinion terminal reply delivery store', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getDbMock.mockReset()
    ensureSchemaMock.mockResolvedValue(undefined)
  })

  it('lists terminal gaps without raw source text and claims only retry-safe states', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      if (text.includes('NOT EXISTS') && text.includes('inverse_opinion_reply_deliveries')) {
        expect(text).not.toContain('source_excerpt')
        expect(text).not.toContain('sender_address')
        return {
          rows: [{
            decision_id: DECISION_ROW.decision_id,
            room_id: '1659',
            source_message_id: SOURCE.messageId,
            terminal_outcome: 'blocked',
            reason_code: 'arena_trading_disabled',
            receipt_summary: {},
          }],
        }
      }
      expect(text).toContain("delivery.delivery_state = 'pending'")
      expect(text).toContain("delivery.delivery_state = 'failed'")
      expect(text).toContain("delivery.delivery_state = 'sending'")
      expect(text).not.toContain("delivery.delivery_state = 'send_unknown'")
      expect(text).toContain("result_delivery.delivery_state = 'sent'")
      return {
        rows: [{
          decision_id: DECISION_ROW.decision_id,
          delivery_kind: 'result',
          room_id: '1659',
          source_message_id: SOURCE.messageId,
          public_text: 'arena trading is off',
          client_message_id: `inverse-opinion:${DECISION_ROW.decision_id}:result`,
          claimant_token: '66666666-6666-4666-8666-666666666666',
        }],
      }
    })
    getDbMock.mockResolvedValue({ sql })
    const {
      claimTerminalReplyDeliveries,
      listTerminalDecisionsMissingReplyDelivery,
    } = await import('../../server/_lib/alfaclub/inverseOpinionTradeStore.js')

    await expect(listTerminalDecisionsMissingReplyDelivery()).resolves.toEqual([
      expect.objectContaining({
        terminalOutcome: 'blocked',
        reasonCode: 'arena_trading_disabled',
      }),
    ])
    await expect(claimTerminalReplyDeliveries()).resolves.toEqual([
      expect.objectContaining({
        deliveryKind: 'result',
        roomId: '1659',
      }),
    ])
  })

  it('persists send_unknown under the active lease without making it retryable', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      expect(text).toContain("delivery_state = 'sending'")
      expect(text).toContain('claimant_token =')
      return { rows: [{ decision_id: DECISION_ROW.decision_id }] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { markTerminalReplyDeliveryUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(markTerminalReplyDeliveryUnknown({
      decisionId: DECISION_ROW.decision_id,
      deliveryKind: 'result',
      claimantToken: '66666666-6666-4666-8666-666666666666',
      errorCode: 'bot_send_unknown',
    })).resolves.toBeUndefined()
  })

  it.each([
    ['mark_sent', 'sent', 'terminal-message-1'],
    ['mark_failed', 'failed', null],
  ] as const)('atomically audits terminal reply %s from send_unknown', async (
    resolution,
    resultingState,
    knownMessageId,
  ) => {
    let statements = 0
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const text = sqlText(strings)
      statements += 1
      if (text.includes('UPDATE alfaclub.inverse_opinion_reply_deliveries')) {
        expect(text).toContain("delivery_state = 'send_unknown'")
        expect(text).toContain('RETURNING')
        expect(text).toContain("'send_unknown'::text AS prior_state")
        return {
          rows: [{
            decision_id: DECISION_ROW.decision_id,
            delivery_kind: 'result',
            prior_state: 'send_unknown',
            resulting_state: resultingState,
            message_id: knownMessageId,
          }],
        }
      }
      expect(text).toContain('inverse_opinion_reply_delivery_resolution_audit')
      expect(text).toContain('operator_address')
      expect(text).toContain('prior_state')
      expect(text).toContain('resulting_state')
      expect(text).toContain('operator_note')
      expect(text).toContain('known_message_id')
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { resolveTerminalReplyDeliverySendUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(resolveTerminalReplyDeliverySendUnknown({
      decisionId: DECISION_ROW.decision_id,
      deliveryKind: 'result',
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolution,
      knownMessageId,
      note: resolution === 'mark_sent'
        ? 'Confirmed in AlfaClub message history.'
        : 'Confirmed no AlfaClub message was published.',
    })).resolves.toEqual({
      decisionId: DECISION_ROW.decision_id,
      deliveryKind: 'result',
      priorState: 'send_unknown',
      resultingState,
      messageId: knownMessageId,
    })
    expect(statements).toBe(2)
  })

  it('rejects terminal reply resolution when the row is no longer send_unknown', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      expect(sqlText(strings)).toContain("delivery_state = 'send_unknown'")
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql })
    const { resolveTerminalReplyDeliverySendUnknown } = await import(
      '../../server/_lib/alfaclub/inverseOpinionTradeStore.js'
    )

    await expect(resolveTerminalReplyDeliverySendUnknown({
      decisionId: DECISION_ROW.decision_id,
      deliveryKind: 'receipt',
      operatorAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      resolution: 'mark_failed',
      knownMessageId: null,
      note: 'Confirmed no AlfaClub message was published.',
    })).rejects.toMatchObject({
      code: 'terminal_reply_send_unknown_resolution_conflict',
    })
    expect(sql).toHaveBeenCalledTimes(1)
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
    expect(migration).toContain("(lifecycle_state = 'closed' AND closed_at IS NOT NULL)")
    expect(migration).toContain("(lifecycle_state <> 'closed' AND closed_at IS NULL)")
    expect(migration).toContain('inverse position attribution quality cannot decrease')
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

  it('stores independent analysis-only verdicts with closed-thesis constraints', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717010000_alfaclub_inverse_opinion_trade_analysis.sql',
      ),
      'utf8',
    )

    expect(migration).toContain('inverse_opinion_trade_analyses')
    expect(migration).toContain("verdict IN ('hold', 'add', 'trim', 'exit', 'watch')")
    expect(migration).toContain("'correct', 'early', 'late', 'invalidated'")
    expect(migration).toContain('CHECK (analysis_only IS TRUE)')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('adds durable parent/reply delivery progress and resolution audit without mutating prior migrations', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717040000_alfaclub_inverse_opinion_trade_journal_reliability.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('inverse_opinion_trade_journal_deliveries')
    expect(migration).toContain('UNIQUE (dispatch_id, delivery_kind, delivery_ordinal)')
    expect(migration).toContain('inverse_opinion_trade_journal_resolution_audit')
    expect(migration).toContain('send_unknown')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
  })

  it('adds immutable public delivery text and submitted recovery completion additively', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717050000_alfaclub_inverse_opinion_trade_recovery_completion.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('ADD COLUMN public_text')
    expect(migration).toContain('ADD COLUMN last_error_code')
    expect(migration).toContain('may already contain rows')
    expect(migration).toContain("SET delivery_state = 'send_unknown'")
    expect(migration).toContain('recovery_deadline_at')
    expect(migration).toContain('execution_phase = \'submitted\'')
    expect(migration).toContain('inverse_opinion_trade_journal_deliveries')
  })

  it('adds bounded immutable revision recovery and explicit resolution fields additively', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717060000_alfaclub_inverse_opinion_trade_revision_recovery.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('ADD COLUMN public_text VARCHAR(2000)')
    expect(migration).toContain('ADD COLUMN claimant_token UUID')
    expect(migration).toContain('ADD COLUMN lease_expires_at TIMESTAMPTZ')
    expect(migration).toContain('ADD COLUMN send_started_at TIMESTAMPTZ')
    expect(migration).toContain('ADD COLUMN recovery_attempt_count INTEGER')
    expect(migration).toContain('ADD COLUMN resolution_operator_address TEXT')
    expect(migration).toContain('ADD COLUMN resolution_note VARCHAR(500)')
    expect(migration).toContain('ADD COLUMN resolved_at TIMESTAMPTZ')
    expect(migration).toContain('inverse_journal_revision_public_text_check')
    expect(migration).toContain('inverse_journal_revision_recovery_idx')
  })

  it('adds a service-role-only immutable terminal reply outbox keyed by decision and kind', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717070000_alfaclub_inverse_opinion_reply_delivery.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('PRIMARY KEY (decision_id, delivery_kind)')
    expect(migration).toContain("delivery_kind IN ('result', 'receipt')")
    expect(migration).toContain("delivery_state IN ('pending', 'sending', 'sent', 'failed', 'send_unknown')")
    expect(migration).toContain('public_text VARCHAR(2000)')
    expect(migration).toContain('inverse_opinion_reply_delivery_payload_guard')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE, DELETE')
    expect(migration).toContain('TO service_role')
    expect(migration).not.toMatch(/\b(source_text|source_excerpt|sender_address)\b/)
  })

  it('adds an immutable audited operator resolution ledger for terminal replies', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        '../supabase/migrations/20260717080000_alfaclub_inverse_opinion_reply_resolution.sql',
      ),
      'utf8',
    )
    expect(migration).toContain('inverse_opinion_reply_delivery_resolution_audit')
    expect(migration).toContain("resolution IN ('mark_sent', 'mark_failed')")
    expect(migration).toContain("prior_state = 'send_unknown'")
    expect(migration).toContain("resulting_state IN ('sent', 'failed')")
    expect(migration).toContain('known_message_id')
    expect(migration).toContain('operator_note VARCHAR(500)')
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('TO service_role')
  })
})
