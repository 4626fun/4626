import { afterEach, beforeAll, describe, expect, it } from 'vitest'

const integrationDbUrl =
  process.env.CONTROL_PLANE_INTEGRATION_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || ''

const shouldRunLinkedDbTests = /^postgres(ql)?:\/\//i.test(integrationDbUrl)

function randomVaultAddress(): `0x${string}` {
  const suffix = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0')
  return `0x${'aa'.repeat(19)}${suffix}` as `0x${string}`
}

type Db = {
  sql: <T = unknown>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows?: T[]; rowCount?: number }>
}

async function loadDb(): Promise<Db | null> {
  if (!shouldRunLinkedDbTests) return null
  if (process.env.CONTROL_PLANE_INTEGRATION_DATABASE_URL) {
    process.env.DATABASE_URL = integrationDbUrl
  }
  const { getDb, isDbConfigured } = await import('@4626/server-core')
  if (!isDbConfigured()) return null
  return (await getDb()) as Db | null
}

async function hasControlPlaneSchema(db: Db): Promise<boolean> {
  const res = await db.sql<{ has_ops: boolean; has_stages: boolean; has_events: boolean; has_jobs: boolean }>`
    SELECT
      to_regclass('public.control_plane_operations') IS NOT NULL AS has_ops,
      to_regclass('public.control_plane_stages') IS NOT NULL AS has_stages,
      to_regclass('public.control_plane_events') IS NOT NULL AS has_events,
      to_regclass('public.keeper_jobs') IS NOT NULL AS has_jobs;
  `
  const row = res.rows?.[0]
  return Boolean(row?.has_ops && row?.has_stages && row?.has_events && row?.has_jobs)
}

async function seedKeeprVault(db: Db, vaultAddress: `0x${string}`): Promise<void> {
  await db.sql`
    INSERT INTO public.keepr_vaults (
      vault_address,
      chain_id,
      group_id,
      creator_coin_address,
      canonical_owner_address,
      config_hash,
      config_json
    ) VALUES (
      ${vaultAddress},
      8453,
      ${`integration-${vaultAddress}`},
      ${'0x2222222222222222222222222222222222222222'},
      ${'0x3333333333333333333333333333333333333333'},
      ${'integration-test'},
      ${'{}'}::jsonb
    )
    ON CONFLICT (vault_address) DO UPDATE SET updated_at = NOW();
  `
}

async function cleanupLinkedDbArtifacts(db: Db, params: { operationId?: string; vaultAddress?: string }): Promise<void> {
  if (params.operationId) {
    await db.sql`DELETE FROM public.keeper_jobs WHERE operation_id = ${params.operationId};`
    await db.sql`DELETE FROM public.control_plane_events WHERE operation_id = ${params.operationId};`
    await db.sql`DELETE FROM public.control_plane_stages WHERE operation_id = ${params.operationId};`
    await db.sql`DELETE FROM public.control_plane_operations WHERE operation_id = ${params.operationId};`
  }
  if (params.vaultAddress) {
    await db.sql`DELETE FROM public.keepr_vaults WHERE LOWER(vault_address) = ${params.vaultAddress.toLowerCase()};`
  }
}

describe.skipIf(!shouldRunLinkedDbTests)('control plane linked database integration', () => {
  let db: Db
  let schemaReady = false
  const cleanups: Array<{ operationId?: string; vaultAddress?: string }> = []

  beforeAll(async () => {
    const loaded = await loadDb()
    if (!loaded) return
    db = loaded
    schemaReady = await hasControlPlaneSchema(db)
  })

  afterEach(async () => {
    if (!db) return
    for (const item of cleanups.splice(0)) {
      await cleanupLinkedDbArtifacts(db, item)
    }
  })

  it('queues vault.settle with linked operation, stage, event, and keeper job rows', async () => {
    if (!schemaReady) return expect(schemaReady).toBe(true)

    const { createVaultControlPlane } = await import('../../server/_lib/controlPlane/vaultControlPlane.js')
    const vaultAddress = randomVaultAddress()
    await seedKeeprVault(db, vaultAddress)

    const settledAt = new Date().toISOString()
    const queued = await createVaultControlPlane().settleVault({
      vaultAddress,
      settlementStage: 'completed',
      settledAt,
      requestedBy: 'integration:test',
      idempotencyKey: `integration-settle:${vaultAddress}:${Date.now()}`,
    })

    cleanups.push({ operationId: queued.operationId, vaultAddress })
    expect(queued.accepted).toBe(true)
    expect(queued.operationId).toMatch(/^vault\.settle_/)
    expect(queued.stageId).toMatch(/^stage_/)

    const [operationRes, stageRes, eventRes, jobRes] = await Promise.all([
      db.sql<{ status: string; operation_kind: string }>`
        SELECT status, operation_kind
        FROM public.control_plane_operations
        WHERE operation_id = ${queued.operationId}
        LIMIT 1;
      `,
      db.sql<{ status: string; stage_kind: string }>`
        SELECT status, stage_kind
        FROM public.control_plane_stages
        WHERE stage_id = ${queued.stageId ?? ''}
        LIMIT 1;
      `,
      db.sql<{ event_type: string }>`
        SELECT event_type
        FROM public.control_plane_events
        WHERE operation_id = ${queued.operationId}
        ORDER BY created_at DESC
        LIMIT 1;
      `,
      db.sql<{ kind: string; payload: Record<string, unknown> }>`
        SELECT kind, payload
        FROM public.keeper_jobs
        WHERE operation_id = ${queued.operationId}
        ORDER BY created_at DESC
        LIMIT 1;
      `,
    ])

    expect(operationRes.rows?.[0]?.operation_kind).toBe('vault.settle')
    expect(operationRes.rows?.[0]?.status).toBe('queued')
    expect(stageRes.rows?.[0]?.stage_kind).toBe('vault.settle')
    expect(stageRes.rows?.[0]?.status).toBe('queued')
    expect(eventRes.rows?.[0]?.event_type).toBe('queue.job_enqueued')
    expect(jobRes.rows?.[0]?.kind).toBe('internal_api')
    expect(jobRes.rows?.[0]?.payload?.path).toBe('/api/keeper/control-plane/settle')

    const { executeSettleVault } = await import('../../server/_lib/controlPlane/executors/executeSettleVault.js')
    const { transitionOperationStatus, transitionStageStatus } = await import(
      '../../server/_lib/controlPlane/operations.js'
    )

    await transitionOperationStatus({
      operationId: queued.operationId,
      nextStatus: 'running',
      reason: 'integration_test_started',
      actor: 'integration:test',
    })
    await transitionStageStatus({
      stageId: queued.stageId!,
      nextStatus: 'running',
      reason: 'integration_test_started',
      actor: 'integration:test',
    })

    const executed = await executeSettleVault({
      vaultAddress,
      settlementStage: 'completed',
      settledAt,
    })
    expect(executed.updated).toBe(true)

    await transitionStageStatus({
      stageId: queued.stageId!,
      nextStatus: 'succeeded',
      reason: 'integration_test_completed',
      actor: 'integration:test',
    })
    await transitionOperationStatus({
      operationId: queued.operationId,
      nextStatus: 'succeeded',
      reason: 'integration_test_completed',
      actor: 'integration:test',
    })

    const vaultRes = await db.sql<{ settlement_stage: string | null; settled_at: string | null }>`
      SELECT settlement_stage, settled_at
      FROM public.keepr_vaults
      WHERE LOWER(vault_address) = ${vaultAddress}
      LIMIT 1;
    `
    expect(vaultRes.rows?.[0]?.settlement_stage).toBe('completed')
    expect(vaultRes.rows?.[0]?.settled_at).toBeTruthy()

    const terminalOp = await db.sql<{ status: string }>`
      SELECT status FROM public.control_plane_operations WHERE operation_id = ${queued.operationId} LIMIT 1;
    `
    expect(terminalOp.rows?.[0]?.status).toBe('succeeded')
  })

  it('queues vault.maintenance with linked keeper job payload', async () => {
    if (!schemaReady) return expect(schemaReady).toBe(true)

    const { createVaultControlPlane } = await import('../../server/_lib/controlPlane/vaultControlPlane.js')
    const vaultAddress = randomVaultAddress()
    await seedKeeprVault(db, vaultAddress)

    const queued = await createVaultControlPlane().runMaintenanceCycle(vaultAddress)
    cleanups.push({ operationId: queued.operationId, vaultAddress })

    expect(queued.accepted).toBe(true)

    const jobRes = await db.sql<{ payload: Record<string, unknown> }>`
      SELECT payload
      FROM public.keeper_jobs
      WHERE operation_id = ${queued.operationId}
      ORDER BY created_at DESC
      LIMIT 1;
    `
    expect(jobRes.rows?.[0]?.payload?.path).toBe('/api/keeper/control-plane/maintenance')
  })
})
