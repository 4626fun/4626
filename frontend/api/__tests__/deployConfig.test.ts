import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_config.ts'
import { createMockReq, createMockRes } from './helpers'

const { getSessionAddressMock, isAdminAddressMock, getApiContractsMock } = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  getApiContractsMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: getApiContractsMock,
}))

describe('deploy config handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0x1111111111111111111111111111111111111111')
    isAdminAddressMock.mockReturnValue(true)
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0x2222222222222222222222222222222222222222',
    })
    delete process.env.ALLOW_API_CONTRACT_OVERRIDES
    delete process.env.VITE_DEPLOY_USE_SERVER_CONTINUE
    delete process.env.VITE_DEPLOY_MODE
    delete process.env.DEPLOY_MODE
  })

  it('returns 401 when session is missing', async () => {
    getSessionAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('Sign in required')
  })

  it('returns 403 for non-admin sessions', async () => {
    isAdminAddressMock.mockReturnValueOnce(false)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(res.body?.error).toContain('Admin only')
  })

  it('returns resolved deploy config', async () => {
    process.env.ALLOW_API_CONTRACT_OVERRIDES = '1'
    process.env.VITE_DEPLOY_USE_SERVER_CONTINUE = 'false'
    process.env.VITE_DEPLOY_MODE = 'no_eoa_strict'

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      admin: '0x1111111111111111111111111111111111111111',
      creatorVaultBatcher: '0x2222222222222222222222222222222222222222',
      allowApiContractOverrides: true,
      deployMode: 'no_eoa_strict',
      serverContinue: false,
    })
  })
})
