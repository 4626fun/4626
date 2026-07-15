import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import {
  formatInverseAkitaTradeJournalHealth,
  inspectInverseAkitaJournalArchitecture,
  runInverseAkitaTradeJournalVerification,
  type InverseAkitaTradeJournalHealthSnapshot,
} from '../../scripts/ops/verify-inverse-akita-trade-journal.js'

const NOW = new Date('2026-07-14T12:00:00.000Z')

function healthySnapshot(
  overrides: Partial<InverseAkitaTradeJournalHealthSnapshot> = {},
): InverseAkitaTradeJournalHealthSnapshot {
  return {
    schemaComplete: true,
    outcomeCounts: {
      executed: 3,
      rejected: 1,
      blocked: 1,
      failed: 0,
      incomplete: 0,
    },
    pendingDecisions: 0,
    unknownDecisions: 0,
    incompleteAttribution: 0,
    openLifecycles: 2,
    reconciliationAgeMinutes: 4,
    lastSuccessfulDispatchAgeMinutes: 60,
    sendUnknownDeliveries: 0,
    terminalReplyBacklog: 0,
    terminalReplySendUnknown: 0,
    terminalReplyLastSuccessAgeMinutes: 5,
    latestAnalysisAgeMinutes: 30,
    latestAnalysisFailed: false,
    latestAnalysisFallback: false,
    analysisSamples: 5,
    analysisFallbacks: 0,
    wrongRoomDispatches: 0,
    duplicateWindows: 0,
    duplicateParents: 0,
    overlappingLegacyBriefs: 0,
    ownershipInversions: 0,
    rawTextLeakage: 0,
    nonAnalysisOnlyRows: 0,
    executionReachability: 0,
    ...overrides,
  }
}

describe('InverseAKITA trade-journal read-only verifier', () => {
  it('reports a healthy redacted state', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot()),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {
        ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_BASELINE_SAMPLE_SIZE: '25',
        ALFACLUB_INVERSE_AKITA_TRADE_JOURNAL_BASELINE_CAPTURED_AT: '2026-07-13',
      },
      now: NOW,
      windowHours: 24,
      strict: true,
    })

    expect(result.status).toBe('healthy')
    expect(result.exitCode).toBe(0)
    expect(formatInverseAkitaTradeJournalHealth(result)).toContain('HEALTHY')
  })

  it('reports externally-sent delivery records awaiting reconciliation', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot({ sendUnknownDeliveries: 1 })),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: false,
    })

    expect(result.checks).toContainEqual({
      id: 'delivery_reconciliation',
      severity: 'warn',
      detail: 'send_unknown=1',
    })
  })

  it('reports the redacted terminal reply backlog and last success age', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot({
        terminalReplyBacklog: 2,
        terminalReplySendUnknown: 1,
        terminalReplyLastSuccessAgeMinutes: 7,
      })),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: false,
    })

    expect(result.checks).toContainEqual({
      id: 'terminal_reply_delivery',
      severity: 'warn',
      detail: 'backlog=2 send_unknown=1 last_success_age_min=7',
    })
  })

  it('fails honestly when the database is unavailable', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockRejectedValue(new Error('password=secret source quote')),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: true,
    })

    expect(result.status).toBe('fail')
    expect(result.exitCode).toBe(1)
    const output = formatInverseAkitaTradeJournalHealth(result)
    expect(output).toContain('database_unavailable')
    expect(output).not.toContain('secret')
    expect(output).not.toContain('source quote')
  })

  it.each([
    ['wrong room', { wrongRoomDispatches: 1 }],
    ['duplicate window', { duplicateWindows: 1 }],
    ['duplicate parent', { duplicateParents: 1 }],
    ['dual brief and journal', { overlappingLegacyBriefs: 1 }],
    ['ownership inversion', { ownershipInversions: 1 }],
    ['raw-text leakage', { rawTextLeakage: 1 }],
    ['non-analysis-only row', { nonAnalysisOnlyRows: 1 }],
  ])('strictly fails %s', async (_label, overrides) => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot(overrides)),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: true,
    })

    expect(result.status).toBe('fail')
    expect(result.exitCode).toBe(1)
  })

  it('strictly fails analysis-to-execution reachability', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot()),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 1 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: true,
    })

    expect(result.status).toBe('fail')
    expect(result.exitCode).toBe(1)
  })

  it('keeps the actual journal module graph unreachable from execution', () => {
    expect(inspectInverseAkitaJournalArchitecture()).toEqual({ executionReachability: 0 })
  })

  it('warns observationally without inventing thresholds or failing strict mode', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot({
        pendingDecisions: 4,
        incompleteAttribution: 2,
        reconciliationAgeMinutes: 180,
        lastSuccessfulDispatchAgeMinutes: null,
        analysisSamples: 4,
        analysisFallbacks: 2,
      })),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: true,
    })

    expect(result.status).toBe('warn')
    expect(result.exitCode).toBe(0)
    const output = formatInverseAkitaTradeJournalHealth(result)
    expect(output).toContain('sample_window_hours=24')
    expect(output).toContain('baseline=unavailable')
    expect(output).not.toMatch(/threshold|acceptable|limit=/i)
  })

  it('never renders raw source text, direct message links, wallets, or secrets', async () => {
    const snapshot = healthySnapshot()
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(snapshot),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {
        DATABASE_URL: 'postgresql://user:password@host/db',
        CRON_SECRET: 'super-secret',
      },
      now: NOW,
      windowHours: 24,
      strict: false,
    })

    const output = formatInverseAkitaTradeJournalHealth(result)
    expect(output).not.toContain('postgresql://')
    expect(output).not.toContain('super-secret')
    expect(output).not.toMatch(/0x[a-fA-F0-9]{40}/)
    expect(output).not.toMatch(/\/messages?\//)
  })

  it('labels first-run tracked exposure with incomplete lineage', async () => {
    const result = await runInverseAkitaTradeJournalVerification({
      loadSnapshot: vi.fn().mockResolvedValue(healthySnapshot({
        openLifecycles: 1,
        incompleteAttribution: 1,
        lastSuccessfulDispatchAgeMinutes: null,
      })),
      inspectArchitecture: vi.fn().mockReturnValue({ executionReachability: 0 }),
      env: {},
      now: NOW,
      windowHours: 24,
      strict: false,
    })

    expect(formatInverseAkitaTradeJournalHealth(result)).toContain(
      'first_run=incomplete_lineage',
    )
  })

  it('contains no message, Arena, ACP, Hyperliquid mutation, or store mutation imports/calls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/ops/verify-inverse-akita-trade-journal.ts'),
      'utf8',
    )
    for (const forbiddenImport of [
      'arenaClient',
      'inverseAkitaChatReaction',
      'inverseOpinionTradeRecorder',
      'inverseOpinionTradeReconciler',
      'inverseAkitaTradeJournalSender',
    ]) {
      expect(
        source,
        `ops verifier must not import ${forbiddenImport}`,
      ).not.toMatch(new RegExp(`from\\s+['"][^'"]*${forbiddenImport}`))
    }
    for (const forbiddenCall of [
      'sendAlfaclub',
      'claimOpinion',
      'transitionOpinion',
      'openPosition',
      'persistOpinion',
      'claimOpinionTradeJournalDispatch',
      'transitionOpinionTradeJournalDispatch',
      'fetch(',
    ]) {
      expect(source, `ops verifier must not call ${forbiddenCall}`).not.toContain(forbiddenCall)
    }
  })
})
