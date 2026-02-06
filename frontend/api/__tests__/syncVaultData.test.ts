import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

describe('sync-vault-data hardening', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
    vi.unstubAllGlobals()
    vi.doUnmock('@prisma/client')
  })

  it('requires x-cron-secret header (query secret is ignored)', async () => {
    restoreEnv = applyEnv({ CRON_SECRET: 'cron-test-secret' })

    const mod = await import('../_handlers/_sync-vault-data.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      headers: {},
      query: { secret: 'cron-test-secret' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'Unauthorized' })
  })

  it('persists synced data with Base chainId (8453)', async () => {
    const syncStatusUpsert = vi.fn().mockResolvedValue(undefined)
    const vaultSnapshotUpsert = vi.fn().mockResolvedValue(undefined)
    const dailyStatsUpsert = vi.fn().mockResolvedValue(undefined)

    const prismaClient = {
      syncStatus: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: syncStatusUpsert,
      },
      vaultSnapshot: {
        upsert: vaultSnapshotUpsert,
        findMany: vi.fn().mockResolvedValue([
          {
            feeApr: 1.5,
            totalAmount0: '100',
            totalAmount1: '200',
          },
        ]),
      },
      dailyStats: {
        upsert: dailyStatsUpsert,
      },
      $disconnect: vi.fn().mockResolvedValue(undefined),
    }

    const PrismaClient = vi.fn(() => prismaClient)
    vi.doMock('@prisma/client', () => ({ PrismaClient }))

    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: {
          vault: {
            id: 'vault',
            baseLower: '1',
            baseUpper: '2',
            limitLower: '3',
            limitUpper: '4',
            fullRangeWeight: '100',
            snapshot: [
              {
                timestamp: '1710000000',
                feeApr: '2.5',
                annualVsHoldPerfSince: '1.2',
                totalAmount0: '10',
                totalAmount1: '20',
                totalSupply: '30',
              },
            ],
          },
        },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    restoreEnv = applyEnv({
      CRON_SECRET: 'cron-test-secret',
      CHARM_VAULT_ADDRESS: '0x1111111111111111111111111111111111111111',
    })

    const mod = await import('../_handlers/_sync-vault-data.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'cron-test-secret' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(vaultSnapshotUpsert).toHaveBeenCalled()
    expect(syncStatusUpsert).toHaveBeenCalled()
    expect(dailyStatsUpsert).toHaveBeenCalled()

    const snapshotWrite = vaultSnapshotUpsert.mock.calls[0]?.[0]
    const syncStatusWrite = syncStatusUpsert.mock.calls[0]?.[0]
    const dailyStatsWrite = dailyStatsUpsert.mock.calls[0]?.[0]

    expect(snapshotWrite?.create?.chainId).toBe(8453)
    expect(syncStatusWrite?.create?.chainId).toBe(8453)
    expect(dailyStatsWrite?.create?.chainId).toBe(8453)
  })
})
