import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes, withAuthHeader } from './helpers'

const { resolveCoinPartiesAndOwnerMock, isServerAdminAddressMock, getAjnaVaultRegistryEntryMock, updateAjnaVaultAutomationConfigMock } =
  vi.hoisted(() => ({
    resolveCoinPartiesAndOwnerMock: vi.fn(async () => ({
      owner: '0x1111111111111111111111111111111111111111',
      payoutRecipient: null,
      platformReferrer: null,
      tradeReferrer: null,
      isReferralEnabled: false,
      isVerified: false,
    })),
    isServerAdminAddressMock: vi.fn(() => false),
    getAjnaVaultRegistryEntryMock: vi.fn(async () => null),
    updateAjnaVaultAutomationConfigMock: vi.fn(async () => null),
  }))

vi.mock('../../server/_lib/onchain/coinParties.js', () => ({
  resolveCoinPartiesAndOwner: resolveCoinPartiesAndOwnerMock,
}))

vi.mock('../../server/_lib/infra/trust.js', () => ({
  isServerAdminAddress: isServerAdminAddressMock,
}))

vi.mock('../../server/_lib/ajnaVaultManager/registry.js', () => ({
  getAjnaVaultRegistryEntry: getAjnaVaultRegistryEntryMock,
  updateAjnaVaultAutomationConfig: updateAjnaVaultAutomationConfigMock,
}))

import { getApiHandler } from '../_handlers/_routes.js'
import automationStatusHandler from '../_handlers/deploy/v2/ajna/_automationStatus.js'
import automationControlHandler from '../_handlers/deploy/v2/ajna/_automationControl.js'

describe('deploy ajna automation endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes ajna automation endpoints via API route map', async () => {
    await expect(getApiHandler('deploy/v2/ajna/automation/status')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('deploy/v2/ajna/automation/control')).resolves.toBeTypeOf('function')
  })

  it('rejects unauthenticated status requests', async () => {
    const req = createMockReq({
      method: 'GET',
      query: {
        creatorToken: '0x1111111111111111111111111111111111111111',
        strategyAdapter: '0x2222222222222222222222222222222222222222',
      },
    })
    const res = createMockRes()
    await automationStatusHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns ajna automation status for owner', async () => {
    getAjnaVaultRegistryEntryMock.mockResolvedValueOnce({
      chainId: 8453,
      creatorToken: '0x1111111111111111111111111111111111111111',
      creatorVault: '0x3333333333333333333333333333333333333333',
      strategyAdapter: '0x2222222222222222222222222222222222222222',
      innerAjnaVault: '0x4444444444444444444444444444444444444444',
      ajnaAuth: '0x5555555555555555555555555555555555555555',
      ajnaPool: '0x6666666666666666666666666666666666666666',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      bufferRatioBps: 2000,
      minBucketIndex: 4156,
      maxBucketStep: 20,
      maxAssetsPerMove: 1000n,
      automationStatus: 'dry_run',
      lastRunAt: '2026-05-12T06:00:00.000Z',
      lastSuccessTx: null,
      lastError: null,
      metadata: {},
      createdAt: '2026-05-12T06:00:00.000Z',
      updatedAt: '2026-05-12T06:00:00.000Z',
    })
    const req = createMockReq({
      method: 'GET',
      headers: withAuthHeader({}, '0x1111111111111111111111111111111111111111'),
      query: {
        creatorToken: '0x1111111111111111111111111111111111111111',
        strategyAdapter: '0x2222222222222222222222222222222222222222',
      },
    })
    const res = createMockRes()
    await automationStatusHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('dry_run')
    expect(getAjnaVaultRegistryEntryMock).toHaveBeenCalledTimes(1)
  })

  it('updates automation control for owner', async () => {
    updateAjnaVaultAutomationConfigMock.mockResolvedValueOnce({
      chainId: 8453,
      creatorToken: '0x1111111111111111111111111111111111111111',
      creatorVault: '0x3333333333333333333333333333333333333333',
      strategyAdapter: '0x2222222222222222222222222222222222222222',
      innerAjnaVault: '0x4444444444444444444444444444444444444444',
      ajnaAuth: '0x5555555555555555555555555555555555555555',
      ajnaPool: '0x6666666666666666666666666666666666666666',
      ownerAddress: '0x1111111111111111111111111111111111111111',
      bufferRatioBps: 2000,
      minBucketIndex: 4156,
      maxBucketStep: 10,
      maxAssetsPerMove: 500n,
      automationStatus: 'live',
      lastRunAt: null,
      lastSuccessTx: null,
      lastError: null,
      metadata: {},
      createdAt: '2026-05-12T06:00:00.000Z',
      updatedAt: '2026-05-12T07:00:00.000Z',
    })
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({}, '0x1111111111111111111111111111111111111111'),
      body: {
        creatorToken: '0x1111111111111111111111111111111111111111',
        strategyAdapter: '0x2222222222222222222222222222222222222222',
        automationStatus: 'live',
        maxBucketStep: 10,
        maxAssetsPerMove: '500',
      },
    })
    const res = createMockRes()
    await automationControlHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('live')
    expect(updateAjnaVaultAutomationConfigMock).toHaveBeenCalledTimes(1)
  })
})
