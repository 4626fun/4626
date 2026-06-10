import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { dbSqlMock, getDbMock, ensureKeeprSchemaMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({ rows: [] as any[], rowCount: 0 })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
  ensureKeeprSchemaMock: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
  getDbForCron: getDbMock,
  isDbConfigured: () => true,
}))

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

import { getApiHandler } from '../_handlers/_routes.js'
import claimHandler from '../_handlers/keeper/jobs/_claim.js'
import completeHandler from '../_handlers/keeper/jobs/_complete.js'
import enqueueActiveVaultsHandler from '../_handlers/keeper/jobs/_enqueueActiveVaults.js'
import enqueueBridgeIntegrityHandler from '../_handlers/keeper/jobs/_enqueueBridgeIntegrity.js'
import enqueueEthosSyncHandler from '../_handlers/keeper/jobs/_enqueueEthosSync.js'
import enqueueSolanaReconcileHandler from '../_handlers/keeper/jobs/_enqueueSolanaReconcile.js'
import enqueueStrategyCanaryHandler from '../_handlers/keeper/jobs/_enqueueStrategyCanary.js'
import enqueueStrategySignalsHandler from '../_handlers/keeper/jobs/_enqueueStrategySignals.js'
import enqueueSweepCanaryHandler from '../_handlers/keeper/jobs/_enqueueSweepCanary.js'
import enqueueVaultCanaryHandler from '../_handlers/keeper/jobs/_enqueueVaultCanary.js'
import enqueueHandler from '../_handlers/keeper/jobs/_enqueue.js'
import healthHandler from '../_handlers/keeper/jobs/_health.js'
import processKeeprActionsHandler from '../_handlers/keeper/jobs/_processKeeprActions.js'
import runHandler from '../_handlers/keeper/jobs/_run.js'
import statusHandler from '../_handlers/keeper/jobs/_status.js'

const API_KEY = 'keeper-api-key-for-coordination-tests'
const AUTH = { authorization: `Bearer ${API_KEY}` }

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    kind: 'internal_api',
    status: 'pending',
    priority: 0,
    payload: { path: '/api/keeper/tend', body: { vaultAddress: '0x1111111111111111111111111111111111111111' } },
    result: null,
    source: 'test',
    dedupe_key: 'job:test',
    run_at: new Date('2026-05-06T22:00:00.000Z'),
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
    attempt_count: 0,
    max_attempts: 5,
    last_error: null,
    created_at: new Date('2026-05-06T22:00:00.000Z'),
    updated_at: new Date('2026-05-06T22:00:00.000Z'),
    ...overrides,
  }
}

describe('keeper job coordination handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({ KPR_API_KEY: API_KEY })
  })

  it('routes keeper job endpoints through the API route map', async () => {
    await expect(getApiHandler('keeper/jobs/enqueue')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-active-vaults')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-bridge-integrity')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-ethos-sync')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-solana-reconcile')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-strategy-canary')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-strategy-signals')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-sweep-canary')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/enqueue-vault-canary')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/claim')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/complete')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/process-keepr-actions')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/run')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/status')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('keeper/jobs/health')).resolves.toBeTypeOf('function')
  })

  it('requires machine auth before enqueueing jobs', async () => {
    const req = createMockReq({ method: 'POST', body: { kind: 'internal_api', payload: {} } })
    const res = createMockRes()

    await enqueueHandler(req, res)

    expect(res.statusCode).toBe(401)
    expect(dbSqlMock).not.toHaveBeenCalled()
  })

  it('enqueues a deduped internal API job', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [jobRow()], rowCount: 1 })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        kind: 'internal_api',
        dedupeKey: 'job:test',
        source: 'test',
        payload: {
          path: '/api/keeper/tend',
          body: { vaultAddress: '0x1111111111111111111111111111111111111111' },
        },
      },
    })
    const res = createMockRes()

    await enqueueHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.job?.id).toBe(42)
    expect(dbSqlMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the sweep canary disabled until a strategy is configured', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-sweep-canary',
      KEEPER_SWEEP_CANARY_CCA_STRATEGY_ADDRESS: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-sweep-canary' },
      })
      const res = createMockRes()

      await enqueueSweepCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, job: null, reason: 'not_configured' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues the configured sweep canary with invariant payload and dedupe', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-sweep-canary',
      KEEPER_SWEEP_CANARY_CCA_STRATEGY_ADDRESS: '0x1111111111111111111111111111111111111111',
      KEEPER_SWEEP_CANARY_VAULT_ADDRESS: '0x5555555555555555555555555555555555555555',
      KEEPER_SWEEP_CANARY_CREATOR_COIN_ADDRESS: '0x2222222222222222222222222222222222222222',
      KEEPER_SWEEP_CANARY_SHARE_TOKEN_ADDRESS: '0x3333333333333333333333333333333333333333',
      KEEPER_SWEEP_CANARY_GAUGE_CONTROLLER_ADDRESS: '0x4444444444444444444444444444444444444444',
      KEEPER_SWEEP_CANARY_PAYOUT_RECIPIENT_MODE: 'gauge',
    })
    try {
      dbSqlMock.mockResolvedValueOnce({
        rows: [
          jobRow({
            id: 88,
            kind: 'internal_api',
            dedupe_key: 'sweep-canary:0x1111111111111111111111111111111111111111',
            payload: {
              path: '/api/keeper/sweep',
              body: {
                ccaStrategyAddress: '0x1111111111111111111111111111111111111111',
                enforceInvariants: true,
                markSettled: {
                  vaultAddress: '0x5555555555555555555555555555555555555555',
                },
                invariants: {
                  creatorCoinAddress: '0x2222222222222222222222222222222222222222',
                  shareTokenAddress: '0x3333333333333333333333333333333333333333',
                  gaugeControllerAddress: '0x4444444444444444444444444444444444444444',
                  payoutRecipientMode: 'gauge',
                },
              },
            },
          }),
        ],
        rowCount: 1,
      })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-sweep-canary' },
      })
      const res = createMockRes()

      await enqueueSweepCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.job?.id).toBe(88)
      expect(res.body?.data?.job?.dedupeKey).toBe('sweep-canary:0x1111111111111111111111111111111111111111')
    } finally {
      restoreEnv()
    }
  })

  it('claims due jobs after releasing expired claims', async () => {
    dbSqlMock
      .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [jobRow({ status: 'claimed', claimed_by: 'worker-a', attempt_count: 1 })],
        rowCount: 1,
      })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: { workerId: 'worker-a', limit: 1, leaseSeconds: 120, kinds: ['internal_api'] },
    })
    const res = createMockRes()

    await claimHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.count).toBe(1)
    expect(res.body?.data?.releasedExpiredClaims).toBe(1)
    expect(res.body?.data?.jobs?.[0]?.claimedBy).toBe('worker-a')
    const firstSqlCall = dbSqlMock.mock.calls[0] as unknown[] | undefined
    const releaseExpiredSql = Array.from((firstSqlCall?.[0] ?? []) as Iterable<unknown>).join(' ')
    expect(releaseExpiredSql).toContain("WHEN attempt_count >= max_attempts THEN 'failed'")
    expect(releaseExpiredSql).not.toMatch(/AND\s+attempt_count\s+<\s+max_attempts/)
  })

  it('keeps the vault canary disabled until vault and actions are configured', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-vault-canary',
      KEEPER_VAULT_CANARY_VAULT_ADDRESS: undefined,
      KEEPER_VAULT_CANARY_ACTIONS: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-vault-canary' },
      })
      const res = createMockRes()

      await enqueueVaultCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, jobs: [], reason: 'not_configured' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues configured vault tend and report canary jobs', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-vault-canary',
      KEEPER_VAULT_CANARY_VAULT_ADDRESS: '0x5555555555555555555555555555555555555555',
      KEEPER_VAULT_CANARY_ACTIONS: 'tend,report',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({
          rows: [
            jobRow({
              id: 101,
              dedupe_key: 'vault-tend-canary:0x5555555555555555555555555555555555555555',
              payload: {
                path: '/api/keeper/tend',
                body: { vaultAddress: '0x5555555555555555555555555555555555555555' },
              },
            }),
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            jobRow({
              id: 102,
              dedupe_key: 'vault-report-canary:0x5555555555555555555555555555555555555555',
              payload: {
                path: '/api/keeper/report',
                body: { vaultAddress: '0x5555555555555555555555555555555555555555' },
              },
            }),
          ],
          rowCount: 1,
        })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-vault-canary' },
      })
      const res = createMockRes()

      await enqueueVaultCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.jobs).toHaveLength(2)
      expect(res.body?.data?.jobs?.map((job: any) => job.dedupeKey)).toEqual([
        'vault-tend-canary:0x5555555555555555555555555555555555555555',
        'vault-report-canary:0x5555555555555555555555555555555555555555',
      ])
    } finally {
      restoreEnv()
    }
  })

  it('keeps active vault discovery disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-active-vaults',
      KEEPER_ACTIVE_VAULT_ENQUEUE_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-active-vaults' },
      })
      const res = createMockRes()

      await enqueueActiveVaultsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, jobs: [], scanned: 0, reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('keeps bridge integrity enqueue disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-bridge-integrity',
      KEEPER_BRIDGE_INTEGRITY_ENQUEUE_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-bridge-integrity' },
      })
      const res = createMockRes()

      await enqueueBridgeIntegrityHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, job: null, reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues bridge integrity monitor when enabled', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-bridge-integrity',
      KEEPER_BRIDGE_INTEGRITY_ENQUEUE_ENABLED: '1',
    })
    try {
      dbSqlMock.mockResolvedValueOnce({
        rows: [
          jobRow({
            id: 401,
            dedupe_key: 'bridge-integrity:default',
            payload: {
              path: '/api/keeper/bridge-integrity',
              body: {},
            },
          }),
        ],
        rowCount: 1,
      })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-bridge-integrity' },
      })
      const res = createMockRes()

      await enqueueBridgeIntegrityHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.job?.dedupeKey).toBe('bridge-integrity:default')
    } finally {
      restoreEnv()
    }
  })

  it('keeps ethos sync enqueue disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-ethos-sync',
      KEEPER_ETHOS_SYNC_ENQUEUE_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-ethos-sync' },
      })
      const res = createMockRes()

      await enqueueEthosSyncHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, job: null, reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues ethos sync monitor when enabled', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-ethos-sync',
      KEEPER_ETHOS_SYNC_ENQUEUE_ENABLED: '1',
    })
    try {
      dbSqlMock.mockResolvedValueOnce({
        rows: [
          jobRow({
            id: 451,
            dedupe_key: 'ethos-sync:default',
            payload: {
              path: '/api/keeper/ethos-sync',
              body: {},
            },
          }),
        ],
        rowCount: 1,
      })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-ethos-sync' },
      })
      const res = createMockRes()

      await enqueueEthosSyncHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.job?.dedupeKey).toBe('ethos-sync:default')
    } finally {
      restoreEnv()
    }
  })

  it('keeps strategy canary disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-strategy-canary',
      KEEPER_STRATEGY_CANARY_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-strategy-canary' },
      })
      const res = createMockRes()

      await enqueueStrategyCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, jobs: [], reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues configured Ajna and Charm strategy canaries', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-strategy-canary',
      KEEPER_STRATEGY_CANARY_ENABLED: '1',
      KEEPER_STRATEGY_CANARY_ACTIONS: 'ajna,charm',
      KEEPER_STRATEGY_CANARY_VAULT_ADDRESS: '0x5555555555555555555555555555555555555555',
      KEEPER_STRATEGY_CANARY_GROUP_ID: 'group-1',
      KEEPER_STRATEGY_CANARY_AJNA_AUTH_ADDRESS: '0x7777777777777777777777777777777777777777',
      KEEPER_STRATEGY_CANARY_AJNA_STRATEGY_ADDRESS: '0x8888888888888888888888888888888888888888',
      KEEPER_STRATEGY_CANARY_AJNA_TARGET_BUCKET: '1234',
      KEEPER_STRATEGY_CANARY_CHARM_VAULT_ADDRESS: '0x9999999999999999999999999999999999999999',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({ rows: [{ id: 501 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 502 }], rowCount: 1 })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-strategy-canary' },
      })
      const res = createMockRes()

      await enqueueStrategyCanaryHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.jobs).toEqual([
        {
          id: 501,
          actionType: 'strategy.ajna.rebucket',
          dedupeKey: 'strategy-canary:ajna:0x5555555555555555555555555555555555555555:0x7777777777777777777777777777777777777777:1234',
        },
        {
          id: 502,
          actionType: 'strategy.charm.rebalance',
          dedupeKey: 'strategy-canary:charm:0x5555555555555555555555555555555555555555:0x9999999999999999999999999999999999999999',
        },
      ])
    } finally {
      restoreEnv()
    }
  })

  it('keeps strategy signal polling disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-strategy-signals',
      KEEPER_STRATEGY_SIGNALS_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-strategy-signals' },
      })
      const res = createMockRes()

      await enqueueStrategySignalsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, jobs: [], reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues explicit strategy signal targets when enabled', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-strategy-signals',
      KEEPER_STRATEGY_SIGNALS_ENABLED: '1',
      KEEPER_STRATEGY_SIGNALS_TARGETS_JSON: JSON.stringify([
        {
          vaultAddress: '0x5555555555555555555555555555555555555555',
          groupId: 'group-1',
          actionType: 'strategy.charm.rebalance',
          dedupeKey: 'strategy-signal:charm:test',
          action: {
            charmVaultAddress: '0x9999999999999999999999999999999999999999',
            strategyAddress: '0x9999999999999999999999999999999999999999',
          },
        },
      ]),
    })
    try {
      dbSqlMock.mockResolvedValueOnce({ rows: [{ id: 701 }], rowCount: 1 })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-strategy-signals' },
      })
      const res = createMockRes()

      await enqueueStrategySignalsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.jobs).toEqual([
        {
          id: 701,
          actionType: 'strategy.charm.rebalance',
          dedupeKey: 'strategy-signal:charm:test',
        },
      ])
    } finally {
      restoreEnv()
    }
  })

  it('keeps Solana reconcile disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-solana-reconcile',
      KEEPER_SOLANA_RECONCILE_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-solana-reconcile' },
      })
      const res = createMockRes()

      await enqueueSolanaReconcileHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({ enabled: false, jobs: [], reason: 'disabled' })
      expect(dbSqlMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues configured Solana reconcile actions with checkpoint dedupe', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-solana-reconcile',
      KEEPER_SOLANA_RECONCILE_ENABLED: '1',
      KEEPER_SOLANA_RECONCILE_WORKFLOW: 'solana-orchestrator',
      KEEPER_SOLANA_RECONCILE_ACTIONS: 'relay_entries,settle_fees',
      KEEPER_SOLANA_RECONCILE_CHECKPOINT_PREFIX: 'test-window',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 601, dedupe_key: 'solana-reconcile:solana-orchestrator:test-window:relay_entries' })],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 602, dedupe_key: 'solana-reconcile:solana-orchestrator:test-window:settle_fees' })],
          rowCount: 1,
        })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-solana-reconcile' },
      })
      const res = createMockRes()

      await enqueueSolanaReconcileHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.jobs?.map((job: any) => job.dedupeKey)).toEqual([
        'solana-reconcile:solana-orchestrator:test-window:relay_entries',
        'solana-reconcile:solana-orchestrator:test-window:settle_fees',
      ])
    } finally {
      restoreEnv()
    }
  })

  it('discovers active vault rows and enqueues configured workflows', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-active-vaults',
      KEEPER_ACTIVE_VAULT_ENQUEUE_ENABLED: '1',
      KEEPER_ACTIVE_VAULT_WORKFLOWS: 'sweep,tend,report,rebalance,payout',
      KEEPER_ACTIVE_VAULT_LIMIT: '5',
      KEEPER_ACTIVE_VAULT_VALIDATE_LISTING: 'false',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({
          rows: [
            {
              vault_address: '0x5555555555555555555555555555555555555555',
              chain_id: 8453,
              creator_coin_address: '0x2222222222222222222222222222222222222222',
              share_token_address: '0x3333333333333333333333333333333333333333',
              settled_at: null,
              config_json: {
                vault: {
                  shareTokenAddress: '0x3333333333333333333333333333333333333333',
                },
                contracts: {
                  ccaStrategy: '0x1111111111111111111111111111111111111111',
                  gaugeController: '0x4444444444444444444444444444444444444444',
                  payoutRouter: '0x6666666666666666666666666666666666666666',
                },
              },
            },
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({ rows: [jobRow({ id: 301, dedupe_key: 'active-sweep:0x1111111111111111111111111111111111111111' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [jobRow({ id: 302, dedupe_key: 'active-tend:0x5555555555555555555555555555555555555555' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [jobRow({ id: 303, dedupe_key: 'active-report:0x5555555555555555555555555555555555555555' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [jobRow({ id: 304, dedupe_key: 'active-rebalance:0x5555555555555555555555555555555555555555' })], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [jobRow({ id: 305, dedupe_key: 'active-payout:0x5555555555555555555555555555555555555555' })], rowCount: 1 })
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-active-vaults' },
      })
      const res = createMockRes()

      await enqueueActiveVaultsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.scanned).toBe(1)
      expect(res.body?.data?.jobs?.map((job: any) => job.dedupeKey)).toEqual([
        'active-sweep:0x1111111111111111111111111111111111111111',
        'active-tend:0x5555555555555555555555555555555555555555',
        'active-report:0x5555555555555555555555555555555555555555',
        'active-rebalance:0x5555555555555555555555555555555555555555',
        'active-payout:0x5555555555555555555555555555555555555555',
      ])
    } finally {
      restoreEnv()
    }
  })

  it('rejects completion by a worker that does not own the claim', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [], rowCount: 0 })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: { id: 42, workerId: 'worker-b', status: 'succeeded', result: { ok: true } },
    })
    const res = createMockRes()

    await completeHandler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('keeper_job_not_claimed_by_worker')
  })

  it('lists jobs for status inspection', async () => {
    dbSqlMock.mockResolvedValueOnce({ rows: [jobRow({ status: 'retry' })], rowCount: 1 })
    const req = createMockReq({
      method: 'GET',
      headers: AUTH,
      query: { status: 'retry', limit: '10' },
    })
    const res = createMockRes()

    await statusHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.count).toBe(1)
    expect(res.body?.data?.jobs?.[0]?.status).toBe('retry')
  })

  it('reports retry, failed, and expired claim health counts', async () => {
    dbSqlMock.mockResolvedValueOnce({
      rows: [{ retry: 2, failed: 1, expired_claims: 3, claimed: 4 }],
      rowCount: 1,
    })
    const req = createMockReq({ method: 'GET', headers: AUTH })
    const res = createMockRes()

    await healthHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data).toEqual({
      retry: 2,
      failed: 1,
      expiredClaims: 3,
      claimed: 4,
    })
  })

  it('runs one cron-gated noop worker tick', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: API_KEY,
      CRON_SECRET: 'cron-secret-for-keeper-runner',
      KEEPER_COORDINATION_BASE_URL: 'https://app.4626.fun',
      KEEPER_WORKER_ID: 'test-cron-worker',
    })
    try {
      dbSqlMock
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 77, kind: 'noop', status: 'claimed', claimed_by: 'test-cron-worker' })],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 77, kind: 'noop', status: 'succeeded' })],
          rowCount: 1,
        })
      const req = createMockReq({
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret-for-keeper-runner',
          host: 'app.4626.fun',
          'x-forwarded-proto': 'https',
        },
      })
      const res = createMockRes()

      await runHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.claimed).toBe(1)
      expect(res.body?.data?.results?.[0]).toMatchObject({
        id: 77,
        kind: 'noop',
        status: 'succeeded',
        error: null,
      })
    } finally {
      restoreEnv()
    }
  })

  it('enqueues mark-settled follow-up after a completed sweep job', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: API_KEY,
      CRON_SECRET: 'cron-secret-for-keeper-runner',
      KEEPER_COORDINATION_BASE_URL: 'https://app.4626.fun',
      KEEPER_WORKER_ID: 'test-cron-worker',
    })
    const originalFetch = globalThis.fetch
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              completed: true,
              completionStage: 'completed',
            },
          }),
        })),
      )
      dbSqlMock
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            jobRow({
              id: 201,
              kind: 'internal_api',
              status: 'claimed',
              claimed_by: 'test-cron-worker',
              payload: {
                path: '/api/keeper/sweep',
                body: {
                  ccaStrategyAddress: '0x1111111111111111111111111111111111111111',
                  markSettled: {
                    vaultAddress: '0x5555555555555555555555555555555555555555',
                  },
                },
              },
            }),
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 201, status: 'succeeded' })],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [
            jobRow({
              id: 202,
              kind: 'internal_api',
              dedupe_key: 'mark-settled:0x5555555555555555555555555555555555555555',
              payload: {
                path: '/api/keeper/mark-settled',
                body: {
                  vaultAddress: '0x5555555555555555555555555555555555555555',
                  settlementStage: 'completed',
                },
              },
            }),
          ],
          rowCount: 1,
        })
      const req = createMockReq({
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret-for-keeper-runner',
          host: 'app.4626.fun',
          'x-forwarded-proto': 'https',
        },
      })
      const res = createMockRes()

      await runHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.results?.[0]).toMatchObject({
        id: 201,
        kind: 'internal_api',
        status: 'succeeded',
        followUpJobId: 202,
      })
    } finally {
      vi.unstubAllGlobals()
      if (originalFetch) globalThis.fetch = originalFetch
      restoreEnv()
    }
  })

  it('skips mark-settled follow-up when sweep already applied control-plane settlement', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: API_KEY,
      CRON_SECRET: 'cron-secret-for-keeper-runner',
      KEEPER_COORDINATION_BASE_URL: 'https://app.4626.fun',
      KEEPER_WORKER_ID: 'test-cron-worker',
    })
    const originalFetch = globalThis.fetch
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              completed: true,
              completionStage: 'completed',
              settlementWrite: {
                requested: true,
                applied: true,
                error: null,
              },
            },
          }),
        })),
      )
      dbSqlMock
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            jobRow({
              id: 301,
              kind: 'internal_api',
              status: 'claimed',
              claimed_by: 'test-cron-worker',
              payload: {
                path: '/api/keeper/sweep',
                body: {
                  ccaStrategyAddress: '0x1111111111111111111111111111111111111111',
                  markSettled: {
                    vaultAddress: '0x5555555555555555555555555555555555555555',
                  },
                },
              },
            }),
          ],
          rowCount: 1,
        })
        .mockResolvedValueOnce({
          rows: [jobRow({ id: 301, status: 'succeeded' })],
          rowCount: 1,
        })

      const req = createMockReq({
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret-for-keeper-runner',
          host: 'app.4626.fun',
          'x-forwarded-proto': 'https',
        },
      })
      const res = createMockRes()

      await runHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.results?.[0]).toMatchObject({
        id: 301,
        kind: 'internal_api',
        status: 'succeeded',
      })
      expect(res.body?.data?.results?.[0]?.followUpJobId).toBeUndefined()
      expect(dbSqlMock).toHaveBeenCalledTimes(3)
    } finally {
      vi.unstubAllGlobals()
      if (originalFetch) globalThis.fetch = originalFetch
      restoreEnv()
    }
  })

  it('keeps keepr action processing disabled by default', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-action-process',
      KEEPER_PROCESS_KPR_ACTIONS_ENABLED: undefined,
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-for-action-process' },
      })
      const res = createMockRes()

      await processKeeprActionsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({
        enabled: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
        retried: 0,
      })
    } finally {
      restoreEnv()
    }
  })

  it('processes one pending keepr action when enabled', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-for-action-process',
      KPR_API_KEY: API_KEY,
      KEEPER_COORDINATION_BASE_URL: 'https://app.4626.fun',
      KEEPER_PROCESS_KPR_ACTIONS_ENABLED: '1',
      KEEPER_PROCESS_KPR_ACTIONS_LIMIT: '1',
    })
    const calls: Array<{ url: string; init: RequestInit | undefined }> = []
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string, init?: RequestInit) => {
          calls.push({ url: String(url), init })
          if (String(url).includes('/api/keepr/actions/pending')) {
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: {
                  actions: [
                    {
                      id: 901,
                      vaultAddress: '0x5555555555555555555555555555555555555555',
                      groupId: 'group-1',
                      actionType: 'xmtp.group.sync_members',
                      action: { action: 'xmtp.group.sync_members' },
                      status: 'pending',
                    },
                  ],
                  count: 1,
                },
              }),
            }
          }
          if (String(url).includes('/api/keepr/actions/updateStatus')) {
            return {
              ok: true,
              json: async () => ({ success: true, data: { updated: true } }),
            }
          }
          if (String(url).includes('/api/keepr/actions/execute')) {
            return {
              ok: true,
              json: async () => ({ success: true, data: { executed: true, retryable: false } }),
            }
          }
          return { ok: false, json: async () => ({ success: false, error: 'unexpected_url' }) }
        }),
      )
      const req = createMockReq({
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret-for-action-process',
          host: 'app.4626.fun',
          'x-forwarded-proto': 'https',
        },
      })
      const res = createMockRes()

      await processKeeprActionsHandler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.data).toMatchObject({
        enabled: true,
        processed: 1,
        succeeded: 1,
        failed: 0,
        retried: 0,
      })
      expect(calls.map((call) => call.url)).toEqual([
        'https://app.4626.fun/api/keepr/actions/pending?limit=1',
        'https://app.4626.fun/api/keepr/actions/updateStatus',
        'https://app.4626.fun/api/keepr/actions/execute',
        'https://app.4626.fun/api/keepr/actions/updateStatus',
      ])
    } finally {
      vi.unstubAllGlobals()
      restoreEnv()
    }
  })
})
