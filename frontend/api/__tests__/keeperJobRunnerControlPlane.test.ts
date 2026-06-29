import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  claimDueKeeperJobsMock,
  completeKeeperJobMock,
  releaseExpiredKeeperJobClaimsMock,
  beginOperationExecutionMock,
  transitionOperationStatusMock,
  transitionStageStatusMock,
  enqueueKeeperJobMock,
} = vi.hoisted(() => ({
  claimDueKeeperJobsMock: vi.fn<() => Promise<any[]>>(async () => []),
  completeKeeperJobMock: vi.fn(async () => true),
  releaseExpiredKeeperJobClaimsMock: vi.fn(async () => 0),
  beginOperationExecutionMock: vi.fn(async () => ({ status: 'running', resumedFromTerminal: false })),
  transitionOperationStatusMock: vi.fn(async () => undefined),
  transitionStageStatusMock: vi.fn(async () => undefined),
  enqueueKeeperJobMock: vi.fn(async () => ({ id: 77 })),
}))

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  claimDueKeeperJobs: claimDueKeeperJobsMock,
  completeKeeperJob: completeKeeperJobMock,
  enqueueKeeperJob: enqueueKeeperJobMock,
  releaseExpiredKeeperJobClaims: releaseExpiredKeeperJobClaimsMock,
}))

vi.mock('../../server/_lib/controlPlane/operations.js', () => ({
  beginOperationExecution: beginOperationExecutionMock,
  transitionOperationStatus: transitionOperationStatusMock,
  transitionStageStatus: transitionStageStatusMock,
}))

vi.mock('../../server/_lib/controlPlane/metrics.js', () => ({
  emitControlPlaneMetric: vi.fn(),
}))

import { runKeeperJobTick } from '../../server/_lib/keeperJobs/keeperJobRunner.js'

describe('runKeeperJobTick control-plane internal_api jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            vaultAddress: '0x1111111111111111111111111111111111111111',
            mode: 'standard',
            overall: 'partial',
            steps: [{ action: 'sweep', status: 'failed', error: 'sweep_failed' }],
          },
        }),
      })),
    )
  })

  it('marks control-plane operation and stage manual_review on partial maintenance result', async () => {
    claimDueKeeperJobsMock.mockResolvedValueOnce([
      {
        id: 42,
        kind: 'internal_api',
        operationId: 'op_cp_1',
        stageId: 'stage_cp_1',
        payload: {
          path: '/api/keeper/control-plane/maintenance',
          method: 'POST',
          body: { vaultAddress: '0x1111111111111111111111111111111111111111' },
        },
      },
    ])

    const tick = await runKeeperJobTick({
      baseUrl: 'https://example.test',
      apiKey: 'test-key',
      workerId: 'worker-1',
    })

    expect(tick.claimed).toBe(1)
    expect(tick.results[0]?.status).toBe('succeeded')
    expect(completeKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, status: 'succeeded' }),
    )
    expect(transitionStageStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stageId: 'stage_cp_1',
        nextStatus: 'manual_review',
        reason: 'keeper_job_partial_success',
      }),
    )
    expect(beginOperationExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'op_cp_1',
        reason: 'keeper_job_started',
      }),
    )
    expect(transitionOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'op_cp_1',
        nextStatus: 'manual_review',
        reason: 'keeper_job_partial_success',
      }),
    )
  })

  it('enqueues provision-creator after solana sync-mapping completes', async () => {
    const shareMeshMint = 'ShareMesh111111111111111111111111111111111'
    claimDueKeeperJobsMock.mockResolvedValueOnce([
      {
        id: 51,
        kind: 'internal_api',
        payload: {
          path: '/api/keeper/solana/sync-mapping',
          method: 'POST',
          body: {
            creatorToken: '0x1111111111111111111111111111111111111111',
            shareOft: '0x2222222222222222222222222222222222222222',
            shareMeshMint,
            sourceSessionId: 'dep_abc',
          },
        },
      },
    ])
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { status: 'completed', mappingId: 9 },
        }),
      })),
    )

    const tick = await runKeeperJobTick({
      baseUrl: 'https://example.test',
      apiKey: 'test-key',
      workerId: 'worker-1',
    })

    expect(tick.results[0]?.status).toBe('succeeded')
    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'keeper-solana-sync-mapping-follow-up',
        dedupeKey: `solana-provision-pool:${shareMeshMint.toLowerCase()}`,
        payload: expect.objectContaining({
          path: '/api/keeper/solana/provision-creator',
          body: expect.objectContaining({
            shareMeshMint,
            trigger: 'post_deploy',
          }),
        }),
      }),
    )
  })
})
