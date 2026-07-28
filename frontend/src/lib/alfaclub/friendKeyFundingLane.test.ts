import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  resolveFriendKeyFundingLane,
  ROOM_1659_CREATOR_COIN,
} from './friendKeyFundingLane'

const SHARE = getAddress('0x44710150A469DE368Abc82F05e6217086Be84626')

describe('resolveFriendKeyFundingLane', () => {
  it('defaults to the live Creator Coin + Zora lane', () => {
    const lane = resolveFriendKeyFundingLane({ kind: 'creatorCoin' })
    expect(lane.kind).toBe('creatorCoin')
    expect(lane.pairErc20).toBe(ROOM_1659_CREATOR_COIN)
    expect(lane.ethFundingProvider).toBe('zora')
    expect(lane.routeSummary).toContain('ZORA')
  })

  it('resolves the planned ShareOFT + Uniswap lane without enabling it by default', () => {
    const lane = resolveFriendKeyFundingLane({
      kind: 'shareOft',
      shareOft: SHARE,
    })
    expect(lane.kind).toBe('shareOft')
    expect(lane.pairErc20).toBe(SHARE)
    expect(lane.ethFundingProvider).toBe('uniswap')
    expect(lane.routeHint).toContain('ShareOFT')
  })
})
