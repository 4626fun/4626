import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDbForCronMock,
  isDbConfiguredMock,
  upsertMappingMock,
  enqueueKeeperJobMock,
  enqueueProvisioningMock,
} = vi.hoisted(() => ({
  getDbForCronMock: vi.fn(),
  isDbConfiguredMock: vi.fn(),
  upsertMappingMock: vi.fn(),
  enqueueKeeperJobMock: vi.fn(),
  enqueueProvisioningMock: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  getDbForCron: getDbForCronMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../onchain/solanaShareMeshMappings.js', () => ({
  upsertSolanaShareMeshMapping: upsertMappingMock,
}))

vi.mock('../keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

vi.mock('../creatorStrategy/solanaShareMeshProvisioning.js', () => ({
  enqueueSolanaShareMeshProvisioning: enqueueProvisioningMock,
}))

import {
  parseSolanaDeploySessionMeshConfig,
  persistAndQueueSolanaDeploySessionMapping,
} from './solanaDeploySessionMapping.js'

const CREATOR = '0x1111111111111111111111111111111111111111'
const SHARE_OFT = '0x2222222222222222222222222222222222222222'
const MINT = 'So11111111111111111111111111111111111111112'

describe('Solana deploy-session mapping', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    isDbConfiguredMock.mockReturnValue(true)
    getDbForCronMock.mockResolvedValue({ sql: vi.fn() })
    upsertMappingMock.mockImplementation(async (params: any) => ({
      id: 9,
      creatorToken: params.creatorToken,
      shareOft: params.shareOft,
      shareMeshMint: params.shareMeshMint,
    }))
    enqueueKeeperJobMock.mockResolvedValue({ id: 10 })
    enqueueProvisioningMock.mockResolvedValue({ enqueued: true, jobId: 11 })
  })

  it('keeps disabled, B1, and B2 paths explicit', () => {
    expect(parseSolanaDeploySessionMeshConfig(null)).toEqual({
      enabled: false,
      mode: null,
      shareMeshMint: null,
      b2Stage: null,
    })
    expect(
      parseSolanaDeploySessionMeshConfig({ enabled: true, mode: 'b1', shareMeshMint: MINT }),
    ).toEqual({ enabled: true, mode: 'b1', shareMeshMint: MINT, b2Stage: 'b1' })
    expect(
      parseSolanaDeploySessionMeshConfig({ enabled: true, mode: 'b2', shareMeshMint: MINT }),
    ).toEqual({ enabled: true, mode: 'b2', shareMeshMint: MINT, b2Stage: 'post_lz' })
  })

  it('rejects missing mode and non-canonical mint before persistence', async () => {
    await expect(
      persistAndQueueSolanaDeploySessionMapping({
        sessionId: 'dep_1',
        creatorToken: CREATOR,
        shareOft: SHARE_OFT,
        solanaOvault: { enabled: true, shareMeshMint: MINT },
      }),
    ).rejects.toThrow('solana_deploy_mapping_mode_missing')
    await expect(
      persistAndQueueSolanaDeploySessionMapping({
        sessionId: 'dep_1',
        creatorToken: CREATOR,
        shareOft: SHARE_OFT,
        solanaOvault: { enabled: true, mode: 'b2', shareMeshMint: 'ShareMeshNotCanonical' },
      }),
    ).rejects.toThrow('solana_deploy_mapping_mint_missing_or_invalid')
    expect(upsertMappingMock).not.toHaveBeenCalled()
  })

  it('persists and propagates B2 post_lz through both durable queue paths', async () => {
    await expect(
      persistAndQueueSolanaDeploySessionMapping({
        sessionId: 'dep_b2',
        creatorToken: CREATOR,
        shareOft: SHARE_OFT,
        solanaOvault: { enabled: true, mode: 'b2', shareMeshMint: MINT },
      }),
    ).resolves.toEqual({ shareMeshMint: MINT, mode: 'b2', b2Stage: 'post_lz' })

    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          body: expect.objectContaining({
            payload: expect.objectContaining({ b2Stage: 'post_lz', shareMeshMint: MINT }),
          }),
        }),
      }),
    )
    expect(enqueueProvisioningMock).toHaveBeenCalledWith(
      expect.objectContaining({ b2Stage: 'post_lz', shareMeshMint: MINT }),
    )
  })

  it('fails closed when provisioning is disabled instead of confirming the mesh', async () => {
    enqueueProvisioningMock.mockResolvedValueOnce({
      enqueued: false,
      jobId: null,
      reason: 'disabled',
    })
    await expect(
      persistAndQueueSolanaDeploySessionMapping({
        sessionId: 'dep_b2',
        creatorToken: CREATOR,
        shareOft: SHARE_OFT,
        solanaOvault: { enabled: true, mode: 'b2', shareMeshMint: MINT },
      }),
    ).rejects.toThrow('solana_deploy_mapping_provision_queue_failed:disabled')
  })
})
