import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_config.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getApiContractsMock,
  readRequestPrincipalAddressMock,
  isServerAdminAddressMock,
  resolvePayoutRouterKeeperAddressMock,
  resolvePayoutRouterFeeConfigMock,
} = vi.hoisted(() => ({
  getApiContractsMock: vi.fn(),
  readRequestPrincipalAddressMock: vi.fn(),
  isServerAdminAddressMock: vi.fn(),
  resolvePayoutRouterKeeperAddressMock: vi.fn(),
  resolvePayoutRouterFeeConfigMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  getApiContracts: getApiContractsMock,
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/trust.js', () => ({
  isServerAdminAddress: isServerAdminAddressMock,
}))

vi.mock('../../server/_lib/payoutRouterRuntime.js', () => ({
  resolvePayoutRouterKeeperAddress: resolvePayoutRouterKeeperAddressMock,
  resolvePayoutRouterFeeConfig: resolvePayoutRouterFeeConfigMock,
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
    resolvePayoutRouterFeeConfigMock.mockReturnValue({
      zoraWethFee: 123,
      wethCreatorFee: 456,
    })
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

  it('returns resolved public deploy config', async () => {
    process.env.ALLOW_API_CONTRACT_OVERRIDES = '1'
    process.env.VITE_DEPLOY_USE_SERVER_CONTINUE = 'false'
    process.env.VITE_DEPLOY_MODE = 'no_eoa_strict'
    process.env.VITE_DEPLOYMENT_VERSION = 'v1.4.3-dryrun'

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      creatorVaultBatcher: '0x2222222222222222222222222222222222222222',
      deploymentVersion: 'v1.4.3-dryrun',
      allowApiContractOverrides: true,
      deployMode: 'no_eoa_strict',
      serverContinue: false,
      payoutRouterKeeperAddress: '0x4444444444444444444444444444444444444444',
      zoraToken: '0x3333333333333333333333333333333333333333',
      payoutRouterZoraWethFee: 123,
      payoutRouterWethCreatorFee: 456,
    })
  })
})
