import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData } from 'viem'

import initializeApprovalsHandler from '../_handlers/v1/build/charm/_initializeApprovals.ts'
import ownerEmergencyWithdrawFromCharmHandler from '../_handlers/v1/build/charm/_ownerEmergencyWithdrawFromCharm.ts'
import ownerEmergencyWithdrawHandler from '../_handlers/v1/build/charm/_ownerEmergencyWithdraw.ts'
import rebalanceHandler from '../_handlers/v1/build/charm/_rebalance.ts'
import setActiveHandler from '../_handlers/v1/build/charm/_setActive.ts'
import setAutoFeeTierHandler from '../_handlers/v1/build/charm/_setAutoFeeTier.ts'
import setCharmVaultHandler from '../_handlers/v1/build/charm/_setCharmVault.ts'
import setParametersHandler from '../_handlers/v1/build/charm/_setParameters.ts'
import setSwapPoolHandler from '../_handlers/v1/build/charm/_setSwapPool.ts'
import setUniFactoryHandler from '../_handlers/v1/build/charm/_setUniFactory.ts'
import vaultRebalanceHandler from '../_handlers/v1/build/charm/vault/_rebalance.ts'
import vaultSetStrategyHandler from '../_handlers/v1/build/charm/vault/_setStrategy.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 79, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  isOfficialCharmVault: vi.fn(async () => true),
  officialCharmVaultError: vi.fn((vault: string) => `not_official_charm_vault:${vault}`),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: mocks.getClientIp,
  rateLimitKey: mocks.rateLimitKey,
  RATE_LIMITS: {
    buildCharmCalldata: { windowMs: 60_000, maxRequests: 80 },
  },
}))

vi.mock('../../server/_lib/charmVaults.js', () => ({
  isOfficialCharmVault: mocks.isOfficialCharmVault,
  officialCharmVaultError: mocks.officialCharmVaultError,
}))

const STRATEGY = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'
const ADDRESS_A = '0x3333333333333333333333333333333333333333'
const ADDRESS_B = '0x4444444444444444444444444444444444444444'

const CHARM_STRATEGY_ABI = [
  { type: 'function', name: 'setCharmVault', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setSwapPool', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setUniFactory', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setAutoFeeTier', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  {
    type: 'function',
    name: 'setParameters',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint24' }],
    outputs: [],
  },
  { type: 'function', name: 'setActive', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
  { type: 'function', name: 'initializeApprovals', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'ownerEmergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'ownerEmergencyWithdrawFromCharm', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const

const CHARM_VAULT_ABI = [
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'setRebalanceDelegate', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setManager', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const

describe('v1 build Charm handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readJsonBody.mockImplementation(async (req: any) => req.body ?? null)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
    mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 79, resetAt: Date.now() + 60_000 })
    mocks.isOfficialCharmVault.mockResolvedValue(true)
    mocks.officialCharmVaultError.mockImplementation((vault: string) => `not_official_charm_vault:${vault}`)
  })

  it('returns 429 when Charm build rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({ method: 'POST', body: { strategy: STRATEGY, charmVault: ADDRESS_A } })
    const res = createMockRes()
    await setCharmVaultHandler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Too many requests')
  })

  it('returns 405 for non-POST requests', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await setCharmVaultHandler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('passes through auth guard failure for all Charm handlers', async () => {
    mocks.guardAgentApiRequest.mockImplementation(async ({ res }: any = {}) => {
      res?.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1', auth: null }
    })

    const cases = [
      { handler: setCharmVaultHandler, body: { strategy: STRATEGY, charmVault: ADDRESS_A } },
      { handler: setSwapPoolHandler, body: { strategy: STRATEGY, swapPool: ADDRESS_A } },
      { handler: setUniFactoryHandler, body: { strategy: STRATEGY, uniFactory: ADDRESS_A } },
      { handler: setAutoFeeTierHandler, body: { strategy: STRATEGY, autoFeeTier: true } },
      {
        handler: setParametersHandler,
        body: { strategy: STRATEGY, maxSwapPercent: '3000', swapSlippageBps: '300', depositSlippageBps: '500', swapPoolFee: '3000' },
      },
      { handler: setActiveHandler, body: { strategy: STRATEGY, active: true } },
      { handler: initializeApprovalsHandler, body: { strategy: STRATEGY } },
      { handler: rebalanceHandler, body: { strategy: STRATEGY } },
      { handler: ownerEmergencyWithdrawHandler, body: { strategy: STRATEGY, token: ADDRESS_A, to: ADDRESS_B, amount: '1' } },
      { handler: ownerEmergencyWithdrawFromCharmHandler, body: { strategy: STRATEGY } },
      {
        handler: vaultRebalanceHandler,
        body: { vault: VAULT },
      },
      { handler: vaultSetStrategyHandler, body: { vault: VAULT, strategy: STRATEGY } },
    ] as const

    for (const c of cases) {
      const req = createMockReq({ method: 'POST', body: c.body })
      const res = createMockRes()
      await c.handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(res.body?.success).toBe(false)
    }
  })

  it('builds calldata for address setter handlers', async () => {
    const charmVaultReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, charmVault: ADDRESS_A } })
    const charmVaultRes = createMockRes()
    await setCharmVaultHandler(charmVaultReq, charmVaultRes)
    expect(charmVaultRes.statusCode).toBe(200)
    const expectedCharmVault = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setCharmVault',
      args: [ADDRESS_A],
    })
    expect(charmVaultRes.body?.data?.data).toBe(expectedCharmVault)

    const swapPoolReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, swapPool: ADDRESS_A } })
    const swapPoolRes = createMockRes()
    await setSwapPoolHandler(swapPoolReq, swapPoolRes)
    const expectedSwapPool = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setSwapPool',
      args: [ADDRESS_A],
    })
    expect(swapPoolRes.body?.data?.data).toBe(expectedSwapPool)

    const uniFactoryReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, uniFactory: ADDRESS_A } })
    const uniFactoryRes = createMockRes()
    await setUniFactoryHandler(uniFactoryReq, uniFactoryRes)
    const expectedUniFactory = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setUniFactory',
      args: [ADDRESS_A],
    })
    expect(uniFactoryRes.body?.data?.data).toBe(expectedUniFactory)

    const tampered = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setCharmVault',
      args: [ADDRESS_B],
    })
    expect(charmVaultRes.body?.data?.data).not.toBe(tampered)
  })

  it('rejects non-official Charm vault addresses for Charm vault routes', async () => {
    mocks.isOfficialCharmVault.mockResolvedValue(false)

    const setCharmReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, charmVault: ADDRESS_A } })
    const setCharmRes = createMockRes()
    await setCharmVaultHandler(setCharmReq, setCharmRes)
    expect(setCharmRes.statusCode).toBe(400)
    expect(String(setCharmRes.body?.error ?? '')).toContain('not_official_charm_vault')

    const vaultSetStrategyReq = createMockReq({ method: 'POST', body: { vault: VAULT, strategy: STRATEGY } })
    const vaultSetStrategyRes = createMockRes()
    await vaultSetStrategyHandler(vaultSetStrategyReq, vaultSetStrategyRes)
    expect(vaultSetStrategyRes.statusCode).toBe(400)
    expect(String(vaultSetStrategyRes.body?.error ?? '')).toContain('not_official_charm_vault')

    const vaultRebalanceReq = createMockReq({
      method: 'POST',
      body: { vault: VAULT },
    })
    const vaultRebalanceRes = createMockRes()
    await vaultRebalanceHandler(vaultRebalanceReq, vaultRebalanceRes)
    expect(vaultRebalanceRes.statusCode).toBe(400)
    expect(String(vaultRebalanceRes.body?.error ?? '')).toContain('not_official_charm_vault')
  })

  it('builds calldata for boolean setter handlers and validates boolean input', async () => {
    const autoFeeReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, autoFeeTier: false } })
    const autoFeeRes = createMockRes()
    await setAutoFeeTierHandler(autoFeeReq, autoFeeRes)
    const expectedAutoFee = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setAutoFeeTier',
      args: [false],
    })
    expect(autoFeeRes.body?.data?.data).toBe(expectedAutoFee)

    const setActiveReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, active: true } })
    const setActiveRes = createMockRes()
    await setActiveHandler(setActiveReq, setActiveRes)
    const expectedSetActive = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setActive',
      args: [true],
    })
    expect(setActiveRes.body?.data?.data).toBe(expectedSetActive)
  })

  it('builds setParameters calldata and validates bounds', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        strategy: STRATEGY,
        maxSwapPercent: '3000',
        swapSlippageBps: '300',
        depositSlippageBps: '500',
        swapPoolFee: '3000',
      },
    })
    const res = createMockRes()
    await setParametersHandler(req, res)
    expect(res.statusCode).toBe(200)
    const expected = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setParameters',
      args: [3000n, 300n, 500n, 3000],
    })
    expect(res.body?.data?.data).toBe(expected)

    const tampered = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setParameters',
      args: [3001n, 300n, 500n, 3000],
    })
    expect(res.body?.data?.data).not.toBe(tampered)

    const badBpsReq = createMockReq({
      method: 'POST',
      body: {
        strategy: STRATEGY,
        maxSwapPercent: '10001',
        swapSlippageBps: '300',
        depositSlippageBps: '500',
        swapPoolFee: '3000',
      },
    })
    const badBpsRes = createMockRes()
    await setParametersHandler(badBpsReq, badBpsRes)
    expect(badBpsRes.statusCode).toBe(400)
    expect(String(badBpsRes.body?.error ?? '')).toContain('maxSwapPercent must be between 0 and 10000')

    const badFeeReq = createMockReq({
      method: 'POST',
      body: {
        strategy: STRATEGY,
        maxSwapPercent: '3000',
        swapSlippageBps: '300',
        depositSlippageBps: '500',
        swapPoolFee: '1000001',
      },
    })
    const badFeeRes = createMockRes()
    await setParametersHandler(badFeeReq, badFeeRes)
    expect(badFeeRes.statusCode).toBe(400)
    expect(String(badFeeRes.body?.error ?? '')).toContain('swapPoolFee must be between 0 and 1000000')
  })

  it('builds no-arg strategy actions and emergency withdraw actions', async () => {
    const initReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY } })
    const initRes = createMockRes()
    await initializeApprovalsHandler(initReq, initRes)
    expect(initRes.statusCode).toBe(200)
    const expectedInit = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'initializeApprovals',
      args: [],
    })
    expect(initRes.body?.data?.data).toBe(expectedInit)

    const rebalanceReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY } })
    const rebalanceRes = createMockRes()
    await rebalanceHandler(rebalanceReq, rebalanceRes)
    const expectedRebalance = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'rebalance',
      args: [],
    })
    expect(rebalanceRes.body?.data?.data).toBe(expectedRebalance)

    const emergencyReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, token: ADDRESS_A, to: ADDRESS_B, amount: '42' },
    })
    const emergencyRes = createMockRes()
    await ownerEmergencyWithdrawHandler(emergencyReq, emergencyRes)
    const expectedEmergency = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'ownerEmergencyWithdraw',
      args: [ADDRESS_A, ADDRESS_B, 42n],
    })
    expect(emergencyRes.body?.data?.data).toBe(expectedEmergency)

    const fromCharmReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY } })
    const fromCharmRes = createMockRes()
    await ownerEmergencyWithdrawFromCharmHandler(fromCharmReq, fromCharmRes)
    const expectedFromCharm = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'ownerEmergencyWithdrawFromCharm',
      args: [],
    })
    expect(fromCharmRes.body?.data?.data).toBe(expectedFromCharm)

    const badAmountReq = createMockReq({
      method: 'POST',
      body: { strategy: STRATEGY, token: ADDRESS_A, to: ADDRESS_B, amount: '-1' },
    })
    const badAmountRes = createMockRes()
    await ownerEmergencyWithdrawHandler(badAmountReq, badAmountRes)
    expect(badAmountRes.statusCode).toBe(400)
    expect(String(badAmountRes.body?.error ?? '')).toContain('amount must be >= 0')
  })

  it('builds vault actions and rejects removed legacy modes/fields', async () => {
    const setStrategyReq = createMockReq({ method: 'POST', body: { vault: VAULT, strategy: STRATEGY } })
    const setStrategyRes = createMockRes()
    await vaultSetStrategyHandler(setStrategyReq, setStrategyRes)
    expect(setStrategyRes.statusCode).toBe(200)
    const expectedSetStrategy = encodeFunctionData({
      abi: CHARM_VAULT_ABI,
      functionName: 'setRebalanceDelegate',
      args: [STRATEGY],
    })
    expect(setStrategyRes.body?.data?.data).toBe(expectedSetStrategy)

    const managerSetStrategyReq = createMockReq({
      method: 'POST',
      body: { vault: VAULT, strategy: STRATEGY, mode: 'manager' },
    })
    const managerSetStrategyRes = createMockRes()
    await vaultSetStrategyHandler(managerSetStrategyReq, managerSetStrategyRes)
    expect(managerSetStrategyRes.statusCode).toBe(200)
    const expectedManagerSetStrategy = encodeFunctionData({
      abi: CHARM_VAULT_ABI,
      functionName: 'setManager',
      args: [STRATEGY],
    })
    expect(managerSetStrategyRes.body?.data?.data).toBe(expectedManagerSetStrategy)

    const simpleRebalanceReq = createMockReq({ method: 'POST', body: { vault: VAULT } })
    const simpleRebalanceRes = createMockRes()
    await vaultRebalanceHandler(simpleRebalanceReq, simpleRebalanceRes)
    expect(simpleRebalanceRes.statusCode).toBe(200)
    const expectedSimpleRebalance = encodeFunctionData({
      abi: CHARM_VAULT_ABI,
      functionName: 'rebalance',
      args: [],
    })
    expect(simpleRebalanceRes.body?.data?.data).toBe(expectedSimpleRebalance)

    const removedLegacyModeReq = createMockReq({
      method: 'POST',
      body: { vault: VAULT, mode: 'auto' },
    })
    const removedLegacyModeRes = createMockRes()
    await vaultRebalanceHandler(removedLegacyModeReq, removedLegacyModeRes)
    expect(removedLegacyModeRes.statusCode).toBe(400)
    expect(String(removedLegacyModeRes.body?.error ?? '')).toContain('Legacy rebalance params were removed')

    const removedLegacyFieldsReq = createMockReq({
      method: 'POST',
      body: { vault: VAULT, baseLower: '-120', baseUpper: '120' },
    })
    const removedLegacyFieldsRes = createMockRes()
    await vaultRebalanceHandler(removedLegacyFieldsReq, removedLegacyFieldsRes)
    expect(removedLegacyFieldsRes.statusCode).toBe(400)
    expect(String(removedLegacyFieldsRes.body?.error ?? '')).toContain('Legacy rebalance params were removed')

    const removedLegacyStrategyModeReq = createMockReq({
      method: 'POST',
      body: { vault: VAULT, strategy: STRATEGY, mode: 'legacy-strategy' },
    })
    const removedLegacyStrategyModeRes = createMockRes()
    await vaultSetStrategyHandler(removedLegacyStrategyModeReq, removedLegacyStrategyModeRes)
    expect(removedLegacyStrategyModeRes.statusCode).toBe(400)
    expect(String(removedLegacyStrategyModeRes.body?.error ?? '')).toContain(
      'mode must be one of: delegate, manager',
    )
  })
})
