import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { executeOperatorActionMock, executeSettleVaultMock } = vi.hoisted(() => ({
  executeOperatorActionMock: vi.fn(async () => ({ status: 'executed' })),
  executeSettleVaultMock: vi.fn(async () => ({ status: 'updated' })),
}))

vi.mock('../../server/_lib/controlPlane/executors/executeOperatorAction.js', () => ({
  OperatorActionExecutionError: class OperatorActionExecutionError extends Error {},
  executeOperatorAction: executeOperatorActionMock,
}))

vi.mock('../../server/_lib/controlPlane/executors/executeSettleVault.js', () => ({
  SWEEP_COMPLETION_AUTHORITY: 'sweep-completion',
  SettleVaultExecutionError: class SettleVaultExecutionError extends Error {},
  executeSettleVault: executeSettleVaultMock,
}))

import operatorActionHandler from '../_handlers/keeper/control-plane/_operatorAction.ts'
import settleHandler from '../_handlers/keeper/control-plane/_settle.ts'

const VAULT = `0x${'1'.repeat(40)}`
const AUTH = { authorization: 'Bearer keeper-key' }

describe('keeper control-plane secondary authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyEnv({
      KPR_API_KEY: 'keeper-key',
      KPR_ZONE_KEY_FINANCIAL_EXECUTION: 'financial-zone-key',
      KPR_SWEEP_COMPLETION_KEY: 'sweep-completion-key',
      KPR_ZONE_DISABLE_FINANCIAL_EXECUTION: '0',
      VERCEL_ENV: 'production',
    })
  })

  it('rejects financial operator actions with only the general keeper key', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        vaultAddress: VAULT,
        action: { type: 'vault.tend', vaultAddress: VAULT },
      },
    })
    const res = createMockRes()
    await operatorActionHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(executeOperatorActionMock).not.toHaveBeenCalled()
  })

  it('accepts financial operator actions with the matching zone key', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: { ...AUTH, 'x-keepr-zone-key': 'financial-zone-key' },
      body: {
        vaultAddress: VAULT,
        action: { type: 'vault.tend', vaultAddress: VAULT },
      },
    })
    const res = createMockRes()
    await operatorActionHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(executeOperatorActionMock).toHaveBeenCalledTimes(1)
  })

  it('does not derive completion authority from the request body', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        vaultAddress: VAULT,
        settledAt: new Date().toISOString(),
        settlementStage: 'completed',
        settledAtAuthority: 'sweep-completion',
      },
    })
    const res = createMockRes()
    await settleHandler(req, res)
    expect(res.statusCode).toBe(401)
    expect(executeSettleVaultMock).not.toHaveBeenCalled()
  })

  it('derives completion authority after separate machine authentication', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: {
        ...AUTH,
        'x-keeper-sweep-completion-key': 'sweep-completion-key',
      },
      body: {
        vaultAddress: VAULT,
        settledAt: new Date().toISOString(),
        settlementStage: 'completed',
        settledAtAuthority: 'attacker-controlled',
      },
    })
    const res = createMockRes()
    await settleHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(executeSettleVaultMock).toHaveBeenCalledWith(
      expect.objectContaining({ settledAtAuthority: 'sweep-completion' }),
    )
  })
})
