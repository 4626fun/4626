import { describe, expect, it } from 'vitest'

import { __testHooks } from '../actions/cca-finalization-canonical.action.js'

const address = (digit: string) => `0x${digit.repeat(40)}` as `0x${string}`

describe('canonical CCA finalization workflow', () => {
  it('routes complete registry metadata through the canonical sweep gate', () => {
    const body = __testHooks.buildSweepBody({
      vaultAddress: address('1'),
      chainId: 8453,
      creatorCoinAddress: address('2'),
      shareTokenAddress: address('3'),
      ccaLaunchArmAddress: address('4'),
      gaugeControllerAddress: address('5'),
      oracleAddress: address('6'),
      burnStreamAddress: address('7'),
      payoutRouterAddress: address('8'),
      groupId: 'group',
    }) as any

    expect(body.ccaLaunchArmAddress).toBe(address('4'))
    expect(body.markSettled).toEqual({ vaultAddress: address('1') })
    expect(body.invariants).toMatchObject({
      creatorCoinAddress: address('2'),
      shareTokenAddress: address('3'),
      gaugeControllerAddress: address('5'),
      payoutRecipientMode: 'payout_router',
      payoutRouterAddress: address('8'),
      burnStreamAddress: address('7'),
    })
  })

  it('fails closed when completion invariant metadata is incomplete', () => {
    expect(__testHooks.buildSweepBody({
      vaultAddress: address('1'),
      chainId: 8453,
      creatorCoinAddress: address('2'),
      ccaLaunchArmAddress: address('4'),
      groupId: 'group',
    })).toBeNull()
  })
})
