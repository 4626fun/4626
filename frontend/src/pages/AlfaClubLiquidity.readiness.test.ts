import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'

import {
  getAlfaClubLiquidityDisabledReason,
  parseSlippageBps,
  type AlfaClubSudoswapSnapshot,
} from './AlfaClubLiquidity'

const SENDER = getAddress('0x3000000000000000000000000000000000000003')

function snapshot(overrides: Partial<AlfaClubSudoswapSnapshot> = {}): AlfaClubSudoswapSnapshot {
  return {
    creatorCoinName: 'AKITA',
    creatorCoinSymbol: 'AKITA',
    creatorCoinDecimals: 18,
    creatorCoinBalance: 10_000n,
    keyBalance: 10n,
    erc20AllowanceToPermit2: 0n,
    permit2AllowanceToAdapter: { amount: 0n, expiration: 0n },
    keyApprovedForAdapter: false,
    pairCreatorCoinBalance: 10_000n,
    pairKeyBalance: 10n,
    spotPrice: 1_000n,
    delta: 100n,
    fee: 69_000_000_000_000_000n,
    buyQuote: { errorCode: 0n, amount: 1_000n, protocolFee: 10n, royaltyAmount: 5n },
    sellQuote: { errorCode: 0n, amount: 900n, protocolFee: 10n, royaltyAmount: 5n },
    ...overrides,
  }
}

function ready(overrides: Record<string, unknown> = {}) {
  return {
    configReady: true,
    requestedMarketMatches: true,
    executionAddress: SENDER,
    loading: false,
    snapshot: snapshot(),
    mode: 'buy' as const,
    keyAmount: 1n,
    ...overrides,
  }
}

describe('AlfaClub official Sudoswap market readiness', () => {
  it('fails closed until every deployment pin is configured', () => {
    expect(getAlfaClubLiquidityDisabledReason(ready({ configReady: false }))).toBe(
      'Official Sudoswap market deployment is not configured',
    )
  })

  it('does not route an unregistered room into the room 1659 pair', () => {
    expect(getAlfaClubLiquidityDisabledReason(ready({ requestedMarketMatches: false }))).toBe(
      'No official Sudoswap market is configured for this room',
    )
  })

  it('requires a live OK quote', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          snapshot: snapshot({
            buyQuote: { errorCode: 1n, amount: 0n, protocolFee: 0n, royaltyAmount: 0n },
          }),
        }),
      ),
    ).toBe('A live Sudoswap quote is unavailable')
  })

  it('keeps key quantity and slippage inside the sponsored policy envelope', () => {
    expect(getAlfaClubLiquidityDisabledReason(ready({ keyAmount: 101n }))).toBe(
      'Room key amount exceeds the supported maximum of 100',
    )
    expect(parseSlippageBps('5')).toBe(500n)
    expect(parseSlippageBps('50')).toBe(500n)
  })

  it('checks actual pair inventory before a buy', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          keyAmount: 2n,
          snapshot: snapshot({ pairKeyBalance: 1n }),
        }),
      ),
    ).toBe('The pair has insufficient key inventory')
  })

  it('checks the user key balance and pair coin liabilities before a sell', () => {
    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: 'sell',
          keyAmount: 2n,
          snapshot: snapshot({ keyBalance: 1n }),
        }),
      ),
    ).toBe('FriendKey balance is too low')

    expect(
      getAlfaClubLiquidityDisabledReason(
        ready({
          mode: 'sell',
          snapshot: snapshot({ pairCreatorCoinBalance: 914n }),
        }),
      ),
    ).toBe('The pair has insufficient Creator Coin inventory')
  })

  it('enables the verified buy and sell paths', () => {
    expect(getAlfaClubLiquidityDisabledReason(ready())).toBeNull()
    expect(getAlfaClubLiquidityDisabledReason(ready({ mode: 'sell' }))).toBeNull()
  })
})
