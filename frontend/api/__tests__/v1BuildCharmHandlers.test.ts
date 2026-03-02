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
import setUseZRouterHandler from '../_handlers/v1/build/charm/_setUseZRouter.ts'
import setZRouterHandler from '../_handlers/v1/build/charm/_setZRouter.ts'
import vaultRebalanceHandler from '../_handlers/v1/build/charm/vault/_rebalance.ts'
import vaultSetStrategyHandler from '../_handlers/v1/build/charm/vault/_setStrategy.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
  guardAgentApiRequest: vi.fn(async (_ctx?: any) => ({ ok: true, ip: '127.0.0.1', auth: null })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: mocks.handleOptions,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

const STRATEGY = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'
const ADDRESS_A = '0x3333333333333333333333333333333333333333'
const ADDRESS_B = '0x4444444444444444444444444444444444444444'

const CHARM_STRATEGY_ABI = [
  { type: 'function', name: 'setCharmVault', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setSwapPool', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setZRouter', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
  { type: 'function', name: 'setUseZRouter', stateMutability: 'nonpayable', inputs: [{ type: 'bool' }], outputs: [] },
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
  {
    type: 'function',
    name: 'rebalance',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'swapAmount', type: 'int256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
      { name: 'baseLower', type: 'int24' },
      { name: 'baseUpper', type: 'int24' },
      { name: 'bidLower', type: 'int24' },
      { name: 'bidUpper', type: 'int24' },
      { name: 'askLower', type: 'int24' },
      { name: 'askUpper', type: 'int24' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'setStrategy', stateMutability: 'nonpayable', inputs: [{ type: 'address' }], outputs: [] },
] as const

describe('v1 build Charm handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.readJsonBody.mockImplementation(async (req: any) => req.body ?? null)
    mocks.guardAgentApiRequest.mockResolvedValue({ ok: true, ip: '127.0.0.1', auth: null })
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
      { handler: setZRouterHandler, body: { strategy: STRATEGY, zRouter: ADDRESS_A } },
      { handler: setUseZRouterHandler, body: { strategy: STRATEGY, useZRouter: true } },
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
        body: {
          vault: VAULT,
          swapAmount: '1',
          sqrtPriceLimitX96: '2',
          baseLower: '-100',
          baseUpper: '100',
          bidLower: '-200',
          bidUpper: '-100',
          askLower: '100',
          askUpper: '200',
        },
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

    const zRouterReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, zRouter: ADDRESS_A } })
    const zRouterRes = createMockRes()
    await setZRouterHandler(zRouterReq, zRouterRes)
    const expectedZRouter = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setZRouter',
      args: [ADDRESS_A],
    })
    expect(zRouterRes.body?.data?.data).toBe(expectedZRouter)

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

  it('builds calldata for boolean setter handlers and validates boolean input', async () => {
    const useZRouterReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, useZRouter: true } })
    const useZRouterRes = createMockRes()
    await setUseZRouterHandler(useZRouterReq, useZRouterRes)
    expect(useZRouterRes.statusCode).toBe(200)
    const expectedUseZRouter = encodeFunctionData({
      abi: CHARM_STRATEGY_ABI,
      functionName: 'setUseZRouter',
      args: [true],
    })
    expect(useZRouterRes.body?.data?.data).toBe(expectedUseZRouter)

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

    const badReq = createMockReq({ method: 'POST', body: { strategy: STRATEGY, useZRouter: 'true' } })
    const badRes = createMockRes()
    await setUseZRouterHandler(badReq, badRes)
    expect(badRes.statusCode).toBe(400)
    expect(String(badRes.body?.error ?? '')).toContain('useZRouter must be a boolean')
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

  it('builds vault actions and validates rebalance tick bounds', async () => {
    const setStrategyReq = createMockReq({ method: 'POST', body: { vault: VAULT, strategy: STRATEGY } })
    const setStrategyRes = createMockRes()
    await vaultSetStrategyHandler(setStrategyReq, setStrategyRes)
    expect(setStrategyRes.statusCode).toBe(200)
    const expectedSetStrategy = encodeFunctionData({
      abi: CHARM_VAULT_ABI,
      functionName: 'setStrategy',
      args: [STRATEGY],
    })
    expect(setStrategyRes.body?.data?.data).toBe(expectedSetStrategy)

    const rebalanceReq = createMockReq({
      method: 'POST',
      body: {
        vault: VAULT,
        swapAmount: '-100',
        sqrtPriceLimitX96: '1',
        baseLower: '-120',
        baseUpper: '120',
        bidLower: '-240',
        bidUpper: '-120',
        askLower: '120',
        askUpper: '240',
      },
    })
    const rebalanceRes = createMockRes()
    await vaultRebalanceHandler(rebalanceReq, rebalanceRes)
    expect(rebalanceRes.statusCode).toBe(200)
    const expectedRebalance = encodeFunctionData({
      abi: CHARM_VAULT_ABI,
      functionName: 'rebalance',
      args: [-100n, 1n, -120, 120, -240, -120, 120, 240],
    })
    expect(rebalanceRes.body?.data?.data).toBe(expectedRebalance)

    const badTickReq = createMockReq({
      method: 'POST',
      body: {
        vault: VAULT,
        swapAmount: '1',
        sqrtPriceLimitX96: '1',
        baseLower: '-887273',
        baseUpper: '120',
        bidLower: '-240',
        bidUpper: '-120',
        askLower: '120',
        askUpper: '240',
      },
    })
    const badTickRes = createMockRes()
    await vaultRebalanceHandler(badTickReq, badTickRes)
    expect(badTickRes.statusCode).toBe(400)
    expect(String(badTickRes.body?.error ?? '')).toContain('baseLower out of range')
  })
})
