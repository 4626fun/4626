import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  getSessionAddressMock,
  isAdminAddressMock,
  readBoundedJsonObjectBodyMock,
  provisionVaultEconomyMock,
  runMaintenanceCycleMock,
  queueOperatorActionMock,
} = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  isAdminAddressMock: vi.fn(() => true),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: { body?: unknown }) => req.body ?? {}),
  provisionVaultEconomyMock: vi.fn(async () => ({ accepted: true, operationId: 'op_provision_1', stageId: 'stg_1' })),
  runMaintenanceCycleMock: vi.fn(async () => ({ accepted: true, operationId: 'op_maintenance_1', stageId: 'stg_2' })),
  queueOperatorActionMock: vi.fn(async () => ({ accepted: true, operationId: 'op_action_1', stageId: 'stg_3' })),
}))

vi.mock('../../packages/server-core/src/index.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../packages/server-core/src/index.js')
  return {
    ...actual,
    getSessionAddress: getSessionAddressMock,
    isAdminAddress: isAdminAddressMock,
    readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  }
})

vi.mock('../../server/_lib/controlPlane/vaultControlPlane.js', () => ({
  VaultControlPlaneError: class VaultControlPlaneError extends Error {
    statusCode: number
    code: string

    constructor(params: { statusCode: number; code: string; message: string }) {
      super(params.message)
      this.statusCode = params.statusCode
      this.code = params.code
    }
  },
  createVaultControlPlane: () => ({
    provisionVaultEconomy: provisionVaultEconomyMock,
    runMaintenanceCycle: runMaintenanceCycleMock,
    queueOperatorAction: queueOperatorActionMock,
  }),
}))

import { getApiHandler } from '../_handlers/_routes.js'
import maintenanceHandler from '../_handlers/admin/control-plane/_maintenance.ts'
import operatorActionHandler from '../_handlers/admin/control-plane/_operatorAction.ts'
import provisionHandler from '../_handlers/admin/control-plane/_provision.ts'

describe('admin control-plane mutation handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    isAdminAddressMock.mockReturnValue(true)
    readBoundedJsonObjectBodyMock.mockImplementation(async (req: { body?: unknown }) => req.body ?? {})
  })

  it('registers new admin control-plane mutation routes', async () => {
    await expect(getApiHandler('admin/control-plane/provision')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('admin/control-plane/maintenance')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('admin/control-plane/operator-action')).resolves.toBeTypeOf('function')
  })

  it('requires admin session for mutation handlers', async () => {
    getSessionAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'POST', body: { vaultAddress: '0x1111111111111111111111111111111111111111' } })
    const res = createMockRes()
    await provisionHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('queues provision operation', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        creatorAddress: '0x2222222222222222222222222222222222222222',
        strategyVariant: 'default',
      },
    })
    const res = createMockRes()
    await provisionHandler(req, res)

    expect(res.statusCode).toBe(202)
    expect(provisionVaultEconomyMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.operationId).toBe('op_provision_1')
  })

  it('queues maintenance operation', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { vaultAddress: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()
    await maintenanceHandler(req, res)

    expect(res.statusCode).toBe(202)
    expect(runMaintenanceCycleMock).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111')
  })

  it('queues operator action operation', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        actionType: 'vault.sweep',
        payload: { ccaStrategyAddress: '0x3333333333333333333333333333333333333333' },
      },
    })
    const res = createMockRes()
    await operatorActionHandler(req, res)

    expect(res.statusCode).toBe(202)
    expect(queueOperatorActionMock).toHaveBeenCalledTimes(1)
    expect(res.body?.data?.operationId).toBe('op_action_1')
  })
})

