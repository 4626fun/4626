import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import type { AjnaVaultRegistryRow } from '../../server/_lib/ajnaVaultManager/registry'
import type { EnqueueKeeperJobInput } from '../../server/_lib/keeperJobs/keeperJobs'

const { listAjnaVaultRegistryEntriesMock, enqueueKeeperJobMock } = vi.hoisted(() => ({
  listAjnaVaultRegistryEntriesMock: vi.fn(
    async (): Promise<AjnaVaultRegistryRow[]> => [],
  ),
  enqueueKeeperJobMock: vi.fn(async (params: EnqueueKeeperJobInput) => ({
    id: 1,
    kind: params.kind,
    status: 'pending',
    priority: 0,
    payload: params.payload,
    result: null,
    source: params.source,
    dedupeKey: params.dedupeKey,
    runAt: new Date().toISOString(),
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
    attemptCount: 0,
    maxAttempts: params.maxAttempts ?? 3,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
}))

vi.mock('../../server/_lib/ajnaVaultManager/registry.js', () => ({
  listAjnaVaultRegistryEntries: listAjnaVaultRegistryEntriesMock,
}))

vi.mock('../../server/_lib/keeperJobs/keeperJobs.js', () => ({
  enqueueKeeperJob: enqueueKeeperJobMock,
}))

import { getApiHandler } from '../_handlers/_routes.js'
import enqueueAjnaManagerHandler from '../_handlers/keeper/jobs/_enqueueAjnaManager.js'

describe('keeper ajna manager enqueue handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes enqueue-ajna-manager through API route map', async () => {
    await expect(getApiHandler('keeper/jobs/enqueue-ajna-manager')).resolves.toBeTypeOf('function')
  })

  it('returns disabled state when feature flag is off', async () => {
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-123456',
      KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED: 'false',
    })
    try {
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-123456' },
      })
      const res = createMockRes()
      await enqueueAjnaManagerHandler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(false)
      expect(listAjnaVaultRegistryEntriesMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('enqueues internal_api jobs for live/dry-run registry rows', async () => {
    listAjnaVaultRegistryEntriesMock.mockResolvedValueOnce([
      {
        chainId: 8453,
        creatorToken: '0x1111111111111111111111111111111111111111',
        creatorVault: '0x3333333333333333333333333333333333333333',
        strategyAdapter: '0x2222222222222222222222222222222222222222',
        innerAjnaVault: '0x4444444444444444444444444444444444444444',
        ajnaAuth: '0x5555555555555555555555555555555555555555',
        ajnaPool: '0x6666666666666666666666666666666666666666',
        ownerAddress: '0x7777777777777777777777777777777777777777',
        bufferRatioBps: 2000,
        minBucketIndex: 4156,
        maxBucketStep: 20,
        maxAssetsPerMove: 1000n,
        automationStatus: 'live',
        lastRunAt: null,
        lastSuccessTx: null,
        lastError: null,
        metadata: {},
        createdAt: '2026-05-12T06:00:00.000Z',
        updatedAt: '2026-05-12T06:00:00.000Z',
      },
    ])
    const restoreEnv = applyEnv({
      CRON_SECRET: 'cron-secret-123456',
      KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED: 'true',
      KEEPER_AJNA_MANAGER_CHAIN_ID: '8453',
      KEEPER_AJNA_MANAGER_LIMIT: '10',
    })
    try {
      const req = createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer cron-secret-123456' },
      })
      const res = createMockRes()
      await enqueueAjnaManagerHandler(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body?.data?.enabled).toBe(true)
      expect(res.body?.data?.jobs?.length).toBe(1)
      expect(enqueueKeeperJobMock).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'internal_api',
          dedupeKey: 'ajna-manager:8453:0x1111111111111111111111111111111111111111:0x2222222222222222222222222222222222222222',
        }),
      )
    } finally {
      restoreEnv()
    }
  })
})
