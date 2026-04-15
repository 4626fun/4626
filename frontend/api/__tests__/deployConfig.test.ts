import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_config.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getApiContractsMock,
  readRequestPrincipalAddressMock,
  isServerAdminAddressMock,
  resolvePayoutRouterKeeperAddressMock,
  resolvePayoutRouterExternalSwapApprovalsMock,
  resolvePayoutRouterFeeConfigMock,
  resolvePayoutRouterZoraTokenMock,
} = vi.hoisted(() => ({
  getApiContractsMock: vi.fn(),
  readRequestPrincipalAddressMock: vi.fn(),
  isServerAdminAddressMock: vi.fn(),
  resolvePayoutRouterKeeperAddressMock: vi.fn(),
  resolvePayoutRouterExternalSwapApprovalsMock: vi.fn(),
  resolvePayoutRouterFeeConfigMock: vi.fn(),
  resolvePayoutRouterZoraTokenMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  getApiContracts: getApiContractsMock,
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/infra/trust.js', () => ({
  isServerAdminAddress: isServerAdminAddressMock,
}))

vi.mock('../../server/_lib/onchain/payoutRouterRuntime.js', () => ({
  resolvePayoutRouterKeeperAddress: resolvePayoutRouterKeeperAddressMock,
  resolvePayoutRouterExternalSwapApprovals: resolvePayoutRouterExternalSwapApprovalsMock,
  resolvePayoutRouterFeeConfig: resolvePayoutRouterFeeConfigMock,
  resolvePayoutRouterZoraToken: resolvePayoutRouterZoraTokenMock,
}))

describe('deploy config handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0x2222222222222222222222222222222222222222',
      zora: '0x3333333333333333333333333333333333333333',
    })
    readRequestPrincipalAddressMock.mockReturnValue('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    isServerAdminAddressMock.mockReturnValue(true)
    resolvePayoutRouterKeeperAddressMock.mockReturnValue('0x4444444444444444444444444444444444444444')
    resolvePayoutRouterExternalSwapApprovalsMock.mockReturnValue({
      targets: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      spenders: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
    })
    resolvePayoutRouterFeeConfigMock.mockReturnValue({
      zoraWethFee: 123,
      wethCreatorFee: 456,
    })
    resolvePayoutRouterZoraTokenMock.mockReturnValue('0x3333333333333333333333333333333333333333')
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES
    delete process.env.VITE_DEPLOY_USE_SERVER_CONTINUE
    delete process.env.VITE_DEPLOY_MODE
    delete process.env.DEPLOY_MODE
    delete process.env.VITE_DEPLOYMENT_VERSION
  })

  it('rejects non-GET methods', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body?.error).toContain('Method not allowed')
  })

  it('returns 401 when no authenticated principal is present', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Not authenticated')
  })

  it('returns 403 for authenticated non-admin callers', async () => {
    isServerAdminAddressMock.mockReturnValueOnce(false)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Admin access required')
  })

  it('returns resolved public deploy config', async () => {
    process.env.ALLOW_API_CONTRACT_OVERRIDES = '1'
    process.env.VITE_DEPLOY_USE_SERVER_CONTINUE = 'false'
    process.env.VITE_DEPLOY_MODE = 'no_eoa_strict'
    process.env.VITE_DEPLOYMENT_VERSION = 'v1.7.1-dryrun'

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      creatorVaultBatcher: '0x2222222222222222222222222222222222222222',
      deploymentVersion: 'v1.7.1-dryrun',
      allowApiContractOverrides: true,
      deployMode: 'no_eoa_strict',
      serverContinue: false,
      payoutRouterKeeperAddress: '0x4444444444444444444444444444444444444444',
      payoutRouterApprovedExternalSwapTargets: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      payoutRouterApprovedExternalSwapSpenders: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      zoraToken: '0x3333333333333333333333333333333333333333',
      payoutRouterZoraWethFee: 123,
      payoutRouterWethCreatorFee: 456,
    })
  })
})
