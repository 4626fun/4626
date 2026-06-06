import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { checkRateLimitMock } = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({
    allowed: true,
    remaining: 1,
    resetAt: Date.now() + 60_000,
  })),
}))

const { executeVaultRebalanceStrategiesMock } = vi.hoisted(() => ({
  executeVaultRebalanceStrategiesMock: vi.fn(async () => ({
    txHash: '0xrebalance123456789012345678901234567890123456789012345678901234',
    status: 'success',
  })),
}))

const { evaluateKeeperStrategyHealthGateMock } = vi.hoisted(() => ({
  evaluateKeeperStrategyHealthGateMock: vi.fn(async () => ({
    blocked: false,
    enabled: false,
    reason: null as string | null,
    statuses: [],
  })),
}))

const { KeeperVaultActionErrorMock } = vi.hoisted(() => ({
  KeeperVaultActionErrorMock: class KeeperVaultActionErrorMock extends Error {
    code: string
    retryable: boolean

    constructor(message: string, params?: { code?: string; retryable?: boolean }) {
      super(message)
      this.code = params?.code ?? 'keeper_vault_action_failed'
      this.retryable = params?.retryable ?? true
    }
  },
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: vi.fn(() => '198.51.100.55'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  RATE_LIMITS: {
    keeperTriggerWrite: { windowMs: 60_000, maxRequests: 60 },
  },
}))

vi.mock('../../server/_lib/controlPlane/executors/keeperVaultActions.js', () => ({
  executeVaultRebalanceStrategies: executeVaultRebalanceStrategiesMock,
  KeeperVaultActionError: KeeperVaultActionErrorMock,
}))

vi.mock('../../server/_lib/keeper/strategyHealthGate.js', () => ({
  evaluateKeeperStrategyHealthGate: evaluateKeeperStrategyHealthGateMock,
}))

import keeperRebalanceStrategiesHandler from '../_handlers/keeper/_rebalanceStrategies.ts'

describe('/api/keeper/rebalance-strategies', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      KPR_API_KEY: 'test-keepr-key',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  const VAULT = '0x' + '2'.repeat(40)
  const AUTH = { authorization: 'Bearer test-keepr-key' }

  async function postBody(body: Record<string, unknown>) {
    const req = createMockReq({ method: 'POST', headers: AUTH, body })
    const res = createMockRes()
    await keeperRebalanceStrategiesHandler(req, res)
    return res
  }

  it('rejects non-POST methods', async () => {
    const req = createMockReq({ method: 'GET', headers: AUTH })
    const res = createMockRes()
    await keeperRebalanceStrategiesHandler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects invalid vault addresses', async () => {
    const res = await postBody({ vaultAddress: 'not-a-vault' })
    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toMatch(/Invalid vaultAddress/i)
  })

  it('executes rebalanceStrategies with default minDeviationBps=500', async () => {
    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.txHash).toMatch(/^0x/)
    expect(executeVaultRebalanceStrategiesMock).toHaveBeenCalledWith(VAULT, 500n)
  })

  it('forwards custom minDeviationBps to the executor', async () => {
    const res = await postBody({ vaultAddress: VAULT, minDeviationBps: 750 })
    expect(res.statusCode).toBe(200)
    expect(executeVaultRebalanceStrategiesMock).toHaveBeenCalledWith(VAULT, 750n)
  })

  it('clamps invalid minDeviationBps before calling the executor', async () => {
    const res = await postBody({ vaultAddress: VAULT, minDeviationBps: -5 })
    expect(res.statusCode).toBe(200)
    expect(executeVaultRebalanceStrategiesMock).toHaveBeenCalledWith(VAULT, 500n)
  })

  it('returns 429 when rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    })

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Rate limit exceeded')
  })

  it('skips when strategy health gate blocks rebalance', async () => {
    evaluateKeeperStrategyHealthGateMock.mockResolvedValueOnce({
      blocked: true,
      enabled: true,
      reason: 'strategy_health_degraded',
      statuses: [],
    })

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(200)
    expect(res.body?.error).toBe('keeper_rebalance_strategy_health_blocked')
    expect(res.body?.data?.status).toBe('skipped')
    expect(res.body?.data?.reason).toBe('strategy_health_degraded')
  })

  it('maps no-strategies executor errors to skip response', async () => {
    executeVaultRebalanceStrategiesMock.mockRejectedValueOnce(
      new KeeperVaultActionErrorMock('no strategies', {
        code: 'rebalance_strategies_no_strategies',
        retryable: false,
      }),
    )

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(200)
    expect(res.body?.error).toBe('keeper_rebalance_no_strategies')
    expect(res.body?.data?.status).toBe('skipped')
    expect(res.body?.data?.reason).toBe('no_strategies')
  })

  it('maps gas-rejected executor errors to skip response', async () => {
    executeVaultRebalanceStrategiesMock.mockRejectedValueOnce(
      new KeeperVaultActionErrorMock('gas rejected', {
        code: 'rebalance_strategies_gas_rejected',
        retryable: false,
      }),
    )

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(200)
    expect(res.body?.error).toBe('keeper_rebalance_gas_rejected')
    expect(res.body?.data?.status).toBe('skipped')
    expect(res.body?.data?.reason).toBe('gas_rejected')
  })

  it('maps reverted executor errors to skip response', async () => {
    executeVaultRebalanceStrategiesMock.mockRejectedValueOnce(
      new KeeperVaultActionErrorMock('execution reverted', {
        code: 'rebalance_strategies_reverted',
        retryable: false,
      }),
    )

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(200)
    expect(res.body?.error).toBe('keeper_rebalance_reverted')
    expect(res.body?.data?.status).toBe('skipped')
    expect(res.body?.data?.reason).toBe('reverted')
  })

  it('surfaces executor failures as 500', async () => {
    executeVaultRebalanceStrategiesMock.mockRejectedValueOnce(new Error('rebalance_strategies_reverted'))

    const res = await postBody({ vaultAddress: VAULT })
    expect(res.statusCode).toBe(500)
    expect(res.body?.error).toMatch(/rebalance_strategies_reverted/i)
  })
})
