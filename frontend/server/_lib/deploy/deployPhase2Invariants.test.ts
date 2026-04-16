import { describe, expect, it } from 'vitest'
import { encodeFunctionData } from 'viem'

import { verifyDeployPhase2Invariants } from './deployPhase2Invariants.ts'

function makeFinalizePhase2Data(params?: {
  creatorToken?: `0x${string}`
  shareToken?: `0x${string}`
  gaugeController?: `0x${string}`
  ccaStrategy?: `0x${string}`
}) {
  return encodeFunctionData({
    abi: [
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
    ] as const,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken: params?.creatorToken ?? '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        vault: '0x0000000000000000000000000000000000000101',
        wrapper: '0x0000000000000000000000000000000000000102',
        shareToken: params?.shareToken ?? '0x0000000000000000000000000000000000000103',
        gaugeController: params?.gaugeController ?? '0x0000000000000000000000000000000000000104',
        ccaStrategy: params?.ccaStrategy ?? '0x0000000000000000000000000000000000000105',
        oracle: '0x0000000000000000000000000000000000000106',
        version: 'vtest',
        depositAmount: 5_000_000n * 10n ** 18n,
        requiredRaise: 1n,
        floorPriceQ96: 1n,
        auctionSteps: '0x',
        meteoraAlphaVault: `0x${'00'.repeat(32)}`,
        solanaIxs: [],
      },
    ],
  })
}

describe('verifyDeployPhase2Invariants', () => {
  it('passes when strategy, share collector, and CreatorCoin payoutRecipient all match the gauge collector', async () => {
    const gaugeController = '0x0000000000000000000000000000000000000104'
    const readContract = async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'feeRecipient':
          return gaugeController
        case 'gaugeController':
          return gaugeController
        case 'payoutRecipient':
          return gaugeController
        case 'creatorShareBps':
          return 1n
        case 'creatorTreasury':
          return '0x0000000000000000000000000000000000000200'
        default:
          throw new Error(`unexpected functionName=${functionName}`)
      }
    }

    const result = await verifyDeployPhase2Invariants({
      publicClient: { readContract },
      phase2FinalizeCalls: [
        {
          to: '0x0000000000000000000000000000000000000010',
          value: 0n,
          data: makeFinalizePhase2Data(),
        },
      ],
      payload: {},
    })

    expect(result.checked).toBe(true)
    expect(result.checksRun).toBe(5)
    expect(result.violations).toEqual([])
    expect(result.expectations?.expectedTradeFeeCollector).toBe(gaugeController)
    expect(result.expectations?.expectedPayoutRecipient).toBe(gaugeController)
    expect(result.expectations?.payoutRecipientMode).toBe('gauge')
  })

  it('flags unresolved payout-router mode when no explicit CreatorCoin payout recipient is available', async () => {
    const gaugeController = '0x0000000000000000000000000000000000000104'
    const readContract = async ({ functionName }: { functionName: string }) => {
      switch (functionName) {
        case 'feeRecipient':
          return gaugeController
        case 'gaugeController':
          return gaugeController
        case 'payoutRecipient':
          return '0x0000000000000000000000000000000000000201'
        case 'creatorShareBps':
          return 0n
        case 'creatorTreasury':
          return '0x0000000000000000000000000000000000000000'
        default:
          throw new Error(`unexpected functionName=${functionName}`)
      }
    }

    const result = await verifyDeployPhase2Invariants({
      publicClient: { readContract },
      phase2FinalizeCalls: [
        {
          to: '0x0000000000000000000000000000000000000010',
          value: 0n,
          data: makeFinalizePhase2Data(),
        },
      ],
      payload: {
        expectedPayoutRecipientMode: 'payout_router',
      },
    })

    expect(result.checked).toBe(true)
    expect(result.violations.map((entry) => entry.code)).toContain('external_revenue_recipient_unresolved')
    expect(result.expectations?.payoutRecipientMode).toBe('payout_router')
    expect(result.expectations?.expectedPayoutRecipient).toBeNull()
  })
})
