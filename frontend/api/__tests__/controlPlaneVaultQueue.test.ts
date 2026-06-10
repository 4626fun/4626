import { beforeEach, describe, expect, it, vi } from 'vitest'

const { transitionOperationStatusMock, transitionStageStatusMock, enqueueKeeperJobMock } = vi.hoisted(() => ({
  transitionOperationStatusMock: vi.fn(async () => undefined),
  transitionStageStatusMock: vi.fn(async () => undefined),
  enqueueKeeperJobMock: vi.fn(
    async (_input: { kind: string; payload: { path: string; method: string } }) => ({ id: 99 }),
  ),
}))

vi.mock('../../server/_lib/controlPlane/operations.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/_lib/controlPlane/operations.js')>(
    '../../server/_lib/controlPlane/operations.js',
  )
  return {
    ...actual,
    transitionOperationStatus: transitionOperationStatusMock,
    transitionStageStatus: transitionStageStatusMock,
    startControlPlaneOperation: vi.fn(async () => ({ operationId: 'op_cp_1', persisted: true, reused: false })),
    createControlPlaneStage: vi.fn(async () => ({ stageId: 'stage_cp_1', persisted: true })),
    addControlPlaneEvent: vi.fn(async () => undefined),
  }
})

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

vi.mock('../../server/_lib/controlPlane/executors/provisionVaultEconomy.js', () => ({
  findDeploySessionByVaultAddress: vi.fn(async () => ({ id: 'deploy_1' })),
}))

const { dbSqlMock, getDbMock } = vi.hoisted(() => ({
  dbSqlMock: vi.fn(async () => ({
    rows: [{ graduated_at: new Date().toISOString(), settled_at: null, settlement_stage_updated_at: null }],
  })),
  getDbMock: vi.fn(async () => ({
    sql: (...args: unknown[]) => (dbSqlMock as unknown as (...a: unknown[]) => Promise<unknown>)(...args),
  })),
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@4626/server-core')
  return {
    ...actual,
    getDb: getDbMock,
    isDbConfigured: () => true,
  }
})

vi.mock('../../server/_lib/keepr/keeprSchema.js', () => ({
  ensureKeeprSchema: vi.fn(async () => undefined),
}))

import { createVaultControlPlane } from '../../server/_lib/controlPlane/vaultControlPlane.js'

describe('vaultControlPlane queueAsyncVerb', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('enqueues internal_api keeper jobs instead of noop', async () => {
    const cp = createVaultControlPlane()
    await cp.runMaintenanceCycle('0x1111111111111111111111111111111111111111')

    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'internal_api',
        payload: expect.objectContaining({
          path: '/api/keeper/control-plane/maintenance',
          method: 'POST',
        }),
      }),
    )
  })

  it('enqueues internal_api keeper jobs for vault.settle', async () => {
    const cp = createVaultControlPlane()
    await cp.settleVault({
      vaultAddress: '0x1111111111111111111111111111111111111111',
      settlementStage: 'completed',
      settledAt: new Date().toISOString(),
    })

    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'internal_api',
        payload: expect.objectContaining({
          path: '/api/keeper/control-plane/settle',
          method: 'POST',
        }),
      }),
    )
  })
})
