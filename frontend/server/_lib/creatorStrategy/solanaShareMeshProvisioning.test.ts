import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

const CREATOR = getAddress('0x1111111111111111111111111111111111111111')

const { enqueueKeeperJobMock, listActivationsMock, isDbConfiguredMock, getDbForCronMock } = vi.hoisted(() => ({
  enqueueKeeperJobMock: vi.fn(async () => ({ id: 99 })),
  listActivationsMock: vi.fn(async () => []),
  isDbConfiguredMock: vi.fn(() => true),
  getDbForCronMock: vi.fn(async () => ({ sql: vi.fn() })),
}))

vi.mock('../keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

vi.mock('../db/postgres.js', () => ({
  isDbConfigured: isDbConfiguredMock,
  getDbForCron: getDbForCronMock,
}))

vi.mock('./activations.js', () => ({
  listActivationsForCreator: listActivationsMock,
}))

import {
  creatorHasSolanaShareMeshEntitlement,
  enqueueSolanaShareMeshProvisioning,
} from './solanaShareMeshProvisioning.js'

describe('creatorHasSolanaShareMeshEntitlement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_SHARE_MESH_PROVISIONING_ENABLED
  })

  it('returns true when vault_full_deploy is active', async () => {
    listActivationsMock.mockResolvedValueOnce([
      {
        id: 1,
        featureKey: 'vault_full_deploy',
        status: 'active',
        paymentVerifiedAt: new Date().toISOString(),
        metadata: {},
      },
    ])
    await expect(creatorHasSolanaShareMeshEntitlement(CREATOR)).resolves.toBe(true)
  })

  it('returns false when no paid Solana keys are present', async () => {
    listActivationsMock.mockResolvedValueOnce([
      {
        id: 2,
        featureKey: 'charm_active_lp',
        status: 'active',
        paymentVerifiedAt: new Date().toISOString(),
        metadata: {},
      },
    ])
    await expect(creatorHasSolanaShareMeshEntitlement(CREATOR)).resolves.toBe(false)
  })
})

describe('enqueueSolanaShareMeshProvisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_SHARE_MESH_PROVISIONING_ENABLED
    listActivationsMock.mockResolvedValue([
      {
        id: 1,
        featureKey: 'vault_full_deploy',
        status: 'pending',
        paymentVerifiedAt: new Date().toISOString(),
        metadata: {},
      },
    ])
  })

  afterEach(() => {
    delete process.env.SOLANA_SHARE_MESH_PROVISIONING_ENABLED
  })

  it('enqueues keeper internal_api job for entitled creators', async () => {
    const result = await enqueueSolanaShareMeshProvisioning({
      creatorToken: CREATOR,
      activationId: 1,
      paymentSource: 'stripe',
      trigger: 'payment',
    })
    expect(result).toEqual({ enqueued: true, jobId: 99 })
    expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'internal_api',
        source: 'creator-strategy.solana-share-mesh',
        payload: expect.objectContaining({
          path: '/api/keeper/solana/provision-creator',
          method: 'POST',
        }),
      }),
    )
  })

  it('skips when provisioning flag is disabled', async () => {
    process.env.SOLANA_SHARE_MESH_PROVISIONING_ENABLED = '0'
    const result = await enqueueSolanaShareMeshProvisioning({
      creatorToken: CREATOR,
      activationId: 1,
      paymentSource: 'usdc_base',
      trigger: 'payment',
    })
    expect(result.enqueued).toBe(false)
    expect(result.reason).toBe('disabled')
    expect(enqueueKeeperJobMock).not.toHaveBeenCalled()
  })
})
