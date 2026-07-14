import { describe, expect, it } from 'vitest'
import { encodeFunctionData, getAddress, keccak256, type Hex } from 'viem'

import { DEPLOY_BYTECODE } from '../../shared/deploy/bytecode.generated.js'
import {
  resolveDeployLanePayoutRouterCodeId,
  resolveDeployLaneRevenuePolicyControllerCodeId,
} from '../../src/lib/deploy/deployLaneBytecode.js'

const VAULT_AUXILIARY_DEPLOY_BATCHER_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Auxiliaries',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'assetToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'swapRouter', type: 'address' },
          { name: 'weth', type: 'address' },
          { name: 'protocolRewards', type: 'address' },
          { name: 'vaultKind', type: 'uint8' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vaultShareBurnStream', type: 'bytes32' },
          { name: 'revenueRouter', type: 'bytes32' },
          { name: 'revenuePolicyController', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const SELECTOR = '0x2c147792'
const BURN_STREAM_CODE_ID = keccak256(DEPLOY_BYTECODE.VaultShareBurnStream as Hex)
const CREATOR_ROUTER = resolveDeployLanePayoutRouterCodeId('creator')
const CREATOR_POLICY = resolveDeployLaneRevenuePolicyControllerCodeId('creator')
const AGENT_ROUTER = resolveDeployLanePayoutRouterCodeId('agent')
const AGENT_POLICY = resolveDeployLaneRevenuePolicyControllerCodeId('agent')

function encodeAux(params: {
  vaultKind: 0 | 1
  revenueRouter: Hex
  revenuePolicyController: Hex
}): Hex {
  return encodeFunctionData({
    abi: VAULT_AUXILIARY_DEPLOY_BATCHER_ABI,
    functionName: 'deployPhase2Auxiliaries',
    args: [
      {
        assetToken: getAddress('0x1111111111111111111111111111111111111111'),
        owner: getAddress('0x2222222222222222222222222222222222222222'),
        vault: getAddress('0x3333333333333333333333333333333333333333'),
        shareOFT: getAddress('0x4444444444444444444444444444444444444444'),
        wrapper: getAddress('0x5555555555555555555555555555555555555555'),
        swapRouter: getAddress('0x2626664c2603336E57B271c5C0b26F421741e481'),
        weth: getAddress('0x4200000000000000000000000000000000000006'),
        protocolRewards: getAddress('0x0000000000000000000000000000000000000000'),
        vaultKind: params.vaultKind,
      },
      {
        vaultShareBurnStream: BURN_STREAM_CODE_ID,
        revenueRouter: params.revenueRouter,
        revenuePolicyController: params.revenuePolicyController,
      },
    ],
  })
}

function assertLaneCodeIdsAllowed(params: {
  vaultKind: 'creator' | 'agent'
  revenueRouter: Hex
  revenuePolicyController: Hex
}): 'allow' | 'deny' {
  const expectedRouter = resolveDeployLanePayoutRouterCodeId(params.vaultKind)
  const expectedPolicy = resolveDeployLaneRevenuePolicyControllerCodeId(params.vaultKind)
  const ok =
    String(params.revenueRouter).toLowerCase() === String(expectedRouter).toLowerCase() &&
    String(params.revenuePolicyController).toLowerCase() === String(expectedPolicy).toLowerCase()
  return ok ? 'allow' : 'deny'
}

describe('paymaster auxiliary lane code-id allow/deny', () => {
  it('uses the lane-aware auxiliary selector', () => {
    const data = encodeAux({
      vaultKind: 0,
      revenueRouter: CREATOR_ROUTER,
      revenuePolicyController: CREATOR_POLICY,
    })
    expect(data.slice(0, 10).toLowerCase()).toBe(SELECTOR)
  })

  it('allows creator lane auxiliaries with CreatorPayoutRouter + CreatorCoinPolicyController', () => {
    expect(
      assertLaneCodeIdsAllowed({
        vaultKind: 'creator',
        revenueRouter: CREATOR_ROUTER,
        revenuePolicyController: CREATOR_POLICY,
      }),
    ).toBe('allow')
  })

  it('allows agent lane auxiliaries with AgentRevenueRouter + AgentRevenuePolicyController', () => {
    expect(
      assertLaneCodeIdsAllowed({
        vaultKind: 'agent',
        revenueRouter: AGENT_ROUTER,
        revenuePolicyController: AGENT_POLICY,
      }),
    ).toBe('allow')
    expect(AGENT_ROUTER).not.toBe(CREATOR_ROUTER)
    expect(AGENT_POLICY).not.toBe(CREATOR_POLICY)
    expect(DEPLOY_BYTECODE.AgentRevenuePolicyController).toMatch(/^0x[0-9a-fA-F]+$/)
  })

  it('denies cross-lane auxiliary bytecode', () => {
    expect(
      assertLaneCodeIdsAllowed({
        vaultKind: 'agent',
        revenueRouter: CREATOR_ROUTER,
        revenuePolicyController: CREATOR_POLICY,
      }),
    ).toBe('deny')
    expect(
      assertLaneCodeIdsAllowed({
        vaultKind: 'creator',
        revenueRouter: AGENT_ROUTER,
        revenuePolicyController: AGENT_POLICY,
      }),
    ).toBe('deny')
  })

  it('denies arbitrary policy controller code ids', () => {
    const arbitrary = keccak256('0xdead' as Hex)
    expect(
      assertLaneCodeIdsAllowed({
        vaultKind: 'agent',
        revenueRouter: AGENT_ROUTER,
        revenuePolicyController: arbitrary,
      }),
    ).toBe('deny')
  })
})
