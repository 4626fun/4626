import { describe, expect, it } from 'vitest'
import { encodeFunctionData } from 'viem'

import { assertDeploySessionPhaseBoundaries } from './deploySessionPhaseBoundaries.ts'

const BATCHER_ABI = [
  {
    type: 'function',
    name: 'finalizePhase2',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareToken', type: 'address' },
          { name: 'gaugeController', type: 'address' },
          { name: 'ccaStrategy', type: 'address' },
          { name: 'oracle', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'auctionSteps', type: 'bytes' },
          { name: 'meteoraAlphaVault', type: 'bytes32' },
          {
            name: 'solanaIxs',
            type: 'tuple[]',
            components: [
              { name: 'programId', type: 'bytes32' },
              { name: 'serializedAccounts', type: 'bytes[]' },
              { name: 'data', type: 'bytes' },
            ],
          },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deployPhase3Strategies',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'initialSqrtPriceX96', type: 'uint160' },
          { name: 'charmVaultName', type: 'string' },
          { name: 'charmVaultSymbol', type: 'string' },
          { name: 'ajnaVaultName', type: 'string' },
          { name: 'ajnaVaultSymbol', type: 'string' },
          { name: 'charmWeightBps', type: 'uint256' },
          { name: 'ajnaWeightBps', type: 'uint256' },
          { name: 'solanaWeightBps', type: 'uint256' },
          { name: 'ajnaBufferRatioBps', type: 'uint256' },
          { name: 'ajnaMinBucketIndex', type: 'uint256' },
          { name: 'ajnaKeeper', type: 'address' },
          { name: 'solanaKeeper', type: 'address' },
          { name: 'solanaMaxNavAge', type: 'uint64' },
          { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
          { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
          { name: 'solanaBridgeAddress', type: 'address' },
          { name: 'enableAutoAllocate', type: 'bool' },
          { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
          { name: 'creatorCharmStrategy', type: 'bytes32' },
          { name: 'ajnaVaultAuth', type: 'bytes32' },
          { name: 'ajnaVault', type: 'bytes32' },
          { name: 'erc4626StrategyAdapter', type: 'bytes32' },
          { name: 'solanaStrategy', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'launchDeferredAuction',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
          { name: 'requiredRaise', type: 'uint128' },
          { name: 'auctionSteps', type: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'auction', type: 'address' }],
  },
] as const

const VAULT_ABI = [
  {
    type: 'function',
    name: 'deployToStrategies',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

const CCA_ABI = [
  {
    type: 'function',
    name: 'migrate',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

function finalizeData(): `0x${string}` {
  return encodeFunctionData({
    abi: BATCHER_ABI,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken: '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        vault: '0x0000000000000000000000000000000000000101',
        wrapper: '0x0000000000000000000000000000000000000102',
        shareToken: '0x0000000000000000000000000000000000000103',
        gaugeController: '0x0000000000000000000000000000000000000104',
        ccaStrategy: '0x0000000000000000000000000000000000000105',
        oracle: '0x0000000000000000000000000000000000000106',
        version: 'vtest',
        depositAmount: 50_000_000n * 10n ** 18n,
        requiredRaise: 1n,
        floorPriceQ96: 1n,
        auctionSteps: '0x',
        meteoraAlphaVault: `0x${'00'.repeat(32)}`,
        solanaIxs: [],
      },
    ],
  })
}

function deployPhase3Data(): `0x${string}` {
  return encodeFunctionData({
    abi: BATCHER_ABI,
    functionName: 'deployPhase3Strategies',
    args: [
      {
        creatorToken: '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        vault: '0x0000000000000000000000000000000000000101',
        version: 'vtest',
        initialSqrtPriceX96: 1n,
        charmVaultName: 'charm',
        charmVaultSymbol: 'charm',
        ajnaVaultName: 'ajna',
        ajnaVaultSymbol: 'ajna',
        charmWeightBps: 4_500n,
        ajnaWeightBps: 4_500n,
        solanaWeightBps: 0n,
        ajnaBufferRatioBps: 0n,
        ajnaMinBucketIndex: 0n,
        ajnaKeeper: '0x0000000000000000000000000000000000000000',
        solanaKeeper: '0x0000000000000000000000000000000000000000',
        solanaMaxNavAge: 0n,
        solanaMaxNavDeltaBpsPerUpdate: 0,
        solanaMinBaseLiquidityBps: 0,
        solanaBridgeAddress: '0x0000000000000000000000000000000000000000',
        enableAutoAllocate: false,
        expectedCharmProtocolFeePips: 0,
      },
      {
        charmAlphaVaultDeploy: `0x${'11'.repeat(32)}`,
        creatorCharmStrategy: `0x${'22'.repeat(32)}`,
        ajnaVaultAuth: `0x${'33'.repeat(32)}`,
        ajnaVault: `0x${'44'.repeat(32)}`,
        erc4626StrategyAdapter: `0x${'55'.repeat(32)}`,
        solanaStrategy: `0x${'66'.repeat(32)}`,
      },
    ],
  })
}

function launchDeferredData(): `0x${string}` {
  return encodeFunctionData({
    abi: BATCHER_ABI,
    functionName: 'launchDeferredAuction',
    args: [
      {
        creatorToken: '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        shareOFT: '0x0000000000000000000000000000000000000103',
        version: 'vtest',
        floorPriceQ96: 1n,
        requiredRaise: 1n,
        auctionSteps: '0x',
      },
    ],
  })
}

describe('assertDeploySessionPhaseBoundaries', () => {
  it('accepts isolated finalize, phase3 strategies, and phase4 launch calls', () => {
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2FinalizeCalls: [{ data: finalizeData() }],
        phase3Calls: [
          { data: deployPhase3Data() },
          {
            data: encodeFunctionData({
              abi: VAULT_ABI,
              functionName: 'deployToStrategies',
            }),
          },
        ],
        phase4Calls: [{ data: launchDeferredData() }],
        hasPhase3: true,
        hasPhase4: true,
      }),
    ).not.toThrow()
  })

  it('rejects deployPhase3Strategies inside phase2 finalize', () => {
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2FinalizeCalls: [{ data: deployPhase3Data() }],
        phase3Calls: [],
        phase4Calls: [],
        hasPhase3: false,
        hasPhase4: false,
      }),
    ).toThrow(/phase2_finalize_boundary_violation/)
  })

  it('rejects migrate in any deploy-session phase', () => {
    const migrateData = encodeFunctionData({ abi: CCA_ABI, functionName: 'migrate' })
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2FinalizeCalls: [{ data: finalizeData() }],
        phase3Calls: [
          { data: deployPhase3Data() },
          {
            data: encodeFunctionData({
              abi: VAULT_ABI,
              functionName: 'deployToStrategies',
            }),
          },
          { data: migrateData },
        ],
        phase4Calls: [],
        hasPhase3: true,
        hasPhase4: false,
      }),
    ).toThrow(/deploy_session_post_auction_call_forbidden:phase3/)
  })

  it('requires deployToStrategies in phase3', () => {
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2FinalizeCalls: [{ data: finalizeData() }],
        phase3Calls: [{ data: deployPhase3Data() }],
        phase4Calls: [],
        hasPhase3: true,
        hasPhase4: false,
      }),
    ).toThrow(/phase3_missing_deploy_to_strategies/)
  })

  it('accepts phase2 pre-finalize aux/whitelist/no-fees before finalize', () => {
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2PreFinalizeCalls: [
          { data: ('0xafe8d7e9' + '00'.repeat(32)) as `0x${string}` },
          { data: ('0x4689260b' + '00'.repeat(64)) as `0x${string}` },
          { data: ('0x8522016e' + '00'.repeat(64)) as `0x${string}` },
        ],
        phase2FinalizeCalls: [{ data: finalizeData() }],
        phase3Calls: [],
        phase4Calls: [],
        hasPhase3: false,
        hasPhase4: false,
      }),
    ).not.toThrow()
  })

  it('rejects finalizePhase2 inside phase2 pre-finalize', () => {
    expect(() =>
      assertDeploySessionPhaseBoundaries({
        phase2PreFinalizeCalls: [{ data: finalizeData() }],
        phase2FinalizeCalls: [],
        phase3Calls: [],
        phase4Calls: [],
        hasPhase3: false,
        hasPhase4: false,
      }),
    ).toThrow(/phase2_pre_finalize_boundary_violation:finalize/)
  })
})
