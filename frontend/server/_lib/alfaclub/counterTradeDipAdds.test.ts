import { describe, expect, it } from 'vitest'
import {
  COUNTER_TRADE_DEFENSE_EXECUTED_REASON,
  COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON,
  COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON,
  countDipAddsForLegSinceReduce,
  extractCoinFromCounterTradeEventKey,
  extractSiloFromCounterTradeEventKey,
  type CounterTradeActionRow,
} from './counterTradeStore.js'

function makeAction(overrides: Partial<CounterTradeActionRow>): CounterTradeActionRow {
  return {
    id: 1,
    roomId: '1659',
    senderAddress: '0xsender',
    eventKey: '0xwallet|1|BTC|100|1|Buy|0|dip|bot',
    status: 'executed',
    reason: COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON,
    counterSide: 'short',
    counterNotionalUsd: 100,
    counterLeverage: 6,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('countDipAddsForLegSinceReduce', () => {
  it('extracts coin and silo from rebalance event keys', () => {
    expect(extractCoinFromCounterTradeEventKey('0xwallet|1|BTC|100|1|Buy|0|dip|bot')).toBe('BTC')
    expect(extractSiloFromCounterTradeEventKey('0xwallet|1|BTC|100|1|Buy|0|dip|bot')).toBe('bot')
    expect(extractCoinFromCounterTradeEventKey('defense|bot|ETH|defend_reduce|123')).toBe('ETH')
    expect(extractSiloFromCounterTradeEventKey('defense|bot|ETH|defend_reduce|123')).toBe('bot')
  })

  it('counts dip adds until a reduce on the same coin+silo', () => {
    const actions: CounterTradeActionRow[] = [
      makeAction({
        id: 1,
        eventKey: '0xwallet|3|BTC|100|1|Buy|0|dip|bot',
      }),
      makeAction({
        id: 2,
        eventKey: '0xwallet|2|BTC|100|1|Buy|0|dip|bot',
      }),
      makeAction({
        id: 3,
        eventKey: '0xwallet|1|BTC|100|1|Buy|0|harvest|bot',
        reason: COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON,
      }),
      makeAction({
        id: 4,
        eventKey: '0xwallet|0|BTC|100|1|Buy|0|dip|bot',
      }),
    ]

    expect(countDipAddsForLegSinceReduce(actions, 'BTC', 'bot')).toBe(2)
  })

  it('ignores dip adds on other coins or silos', () => {
    const actions: CounterTradeActionRow[] = [
      makeAction({ id: 1, eventKey: '0xwallet|1|ETH|100|1|Buy|0|dip|bot' }),
      makeAction({ id: 2, eventKey: '0xwallet|1|BTC|100|1|Buy|0|dip|user' }),
      makeAction({ id: 3, eventKey: '0xwallet|2|BTC|100|1|Buy|0|dip|bot' }),
    ]
    expect(countDipAddsForLegSinceReduce(actions, 'BTC', 'bot')).toBe(1)
  })

  it('resets count after defense reduce on the same silo', () => {
    const actions: CounterTradeActionRow[] = [
      makeAction({ id: 1, eventKey: '0xwallet|2|BTC|100|1|Buy|0|dip|bot' }),
      makeAction({
        id: 2,
        eventKey: 'defense|bot|BTC|defend_reduce|123',
        reason: COUNTER_TRADE_DEFENSE_EXECUTED_REASON,
      }),
      makeAction({ id: 3, eventKey: '0xwallet|1|BTC|100|1|Buy|0|dip|bot' }),
    ]
    expect(countDipAddsForLegSinceReduce(actions, 'BTC', 'bot')).toBe(1)
  })
})
