import { beforeEach, describe, expect, it, vi } from 'vitest'

const { enqueueKeeperJobMock } = vi.hoisted(() => ({
  enqueueKeeperJobMock: vi.fn(async () => ({ id: 42 })),
}))

vi.mock('../keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

vi.mock('./solanaCreatorRelayConfig.js', () => ({
  listRelayEnabledShareMeshMints: vi.fn(async () => []),
}))

import { enqueueSolanaB2ReadinessVerification } from './solanaRelayConfigSync.js'

describe('enqueueSolanaB2ReadinessVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues verify-b2-readiness with persistEvidence so relay config can update', async () => {
    const result = await enqueueSolanaB2ReadinessVerification({
      creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      shareMeshMint: 'ShareMesh111111111111111111111111111111111',
      deploySessionId: 'dep_123',
    })

    expect(result).toEqual({ enqueued: true, jobId: 42 })
    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'internal_api',
        source: 'solana-b2-readiness',
        payload: {
          path: '/api/keeper/solana/verify-b2-readiness',
          method: 'POST',
          body: {
            creatorToken: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
            persistEvidence: true,
            shareMeshMint: 'ShareMesh111111111111111111111111111111111',
            deploySessionId: 'dep_123',
          },
        },
      }),
    )
  })
})
