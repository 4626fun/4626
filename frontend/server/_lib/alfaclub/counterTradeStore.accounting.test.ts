import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  sql: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: vi.fn(async () => ({ sql: mocks.sql })),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureAlfaclubCounterTradeSchema: vi.fn(async () => {}),
}))

vi.mock('../infra/logger.js', () => ({
  logger: { warn: vi.fn() },
}))

import {
  COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON,
  COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON,
  readCounterTradeUsageWindow,
  recordCounterTradeAction,
} from './counterTradeStore.js'

const COMMON = {
  roomId: '1659',
  senderAddress: '0x1111111111111111111111111111111111111111',
  counterSide: 'short' as const,
  counterLeverage: 6,
}

describe('paired-leg rebalance entry accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sql.mockResolvedValue({ rows: [] })
  })

  it('advances the entry cooldown for a dip add but not for its harvest', async () => {
    await recordCounterTradeAction({
      ...COMMON,
      eventKey: 'fill|HYPE|harvest|user',
      status: 'executed',
      reason: COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON,
      counterNotionalUsd: 100,
    })
    expect(mocks.sql).toHaveBeenCalledTimes(1)

    await recordCounterTradeAction({
      ...COMMON,
      eventKey: 'fill|HYPE|dip|bot',
      status: 'executed',
      reason: COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON,
      counterNotionalUsd: 40,
    })
    expect(mocks.sql).toHaveBeenCalledTimes(3)
    const cooldownSql = (mocks.sql.mock.calls[2]?.[0] as TemplateStringsArray)
      .join('?')
      .replace(/\s+/g, ' ')
    expect(cooldownSql).toContain('UPDATE alfaclub.counter_trade_user_opt_in')
  })

  it('counts dip notional in usage while excluding harvest notional', async () => {
    mocks.sql.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?')
      if (!sql.includes('FROM alfaclub.counter_trade_action_ledger')) return { rows: [] }

      const excludedReasons = new Set(values.filter((value): value is string =>
        typeof value === 'string' && value.includes('executed'),
      ))
      const ledger = [
        { reason: COUNTER_TRADE_REBALANCE_HARVEST_EXECUTED_REASON, notionalUsd: 100 },
        { reason: COUNTER_TRADE_REBALANCE_DIP_EXECUTED_REASON, notionalUsd: 40 },
      ]
      const entries = ledger.filter((row) => !excludedReasons.has(row.reason))
      return {
        rows: [{
          action_count: ledger.length,
          executed_count: entries.length,
          notional_usd: String(entries.reduce((sum, row) => sum + row.notionalUsd, 0)),
        }],
      }
    })

    const usage = await readCounterTradeUsageWindow({
      roomId: COMMON.roomId,
      senderAddress: COMMON.senderAddress,
      sinceMs: 0,
    })

    expect(usage).toEqual({ actionCount: 2, executedCount: 1, notionalUsd: 40 })
  })
})
