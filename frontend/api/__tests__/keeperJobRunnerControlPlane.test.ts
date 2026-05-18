import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  claimDueKeeperJobsMock,
  completeKeeperJobMock,
  releaseExpiredKeeperJobClaimsMock,
  transitionOperationStatusMock,
  transitionStageStatusMock,
} = vi.hoisted(() => ({
  claimDueKeeperJobsMock: vi.fn<() => Promise<any[]>>(async () => []),
  completeKeeperJobMock: vi.fn(async () => true),
  releaseExpiredKeeperJobClaimsMock: vi.fn(async () => 0),
  transitionOperationStatusMock: vi.fn(async () => undefined),
  transitionStageStatusMock: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  claimDueKeeperJobs: claimDueKeeperJobsMock,
  completeKeeperJob: completeKeeperJobMock,
  enqueueKeeperJob: vi.fn(async () => ({ id: 0 })),
  releaseExpiredKeeperJobClaims: releaseExpiredKeeperJobClaimsMock,
}))

vi.mock('../../server/_lib/controlPlane/operations.js', () => ({
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
    expect(transitionOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'op_cp_1',
        nextStatus: 'manual_review',
        reason: 'keeper_job_partial_success',
      }),
    )
  })
})
