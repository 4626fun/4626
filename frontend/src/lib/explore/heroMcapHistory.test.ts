import { describe, expect, it } from 'vitest'

import { sanitizeHeroMcapHistory } from './heroMcapHistory'

describe('sanitizeHeroMcapHistory', () => {
  it('interpolates spoof FDV spike days between inliers', () => {
    const history = [
      { date: '2026-07-23', creatorCoinsMarketCapUsd: 129_000_000 },
      { date: '2026-07-24', creatorCoinsMarketCapUsd: 1_150_000_000 },
      { date: '2026-07-25', creatorCoinsMarketCapUsd: 1_140_000_000 },
      { date: '2026-07-26', creatorCoinsMarketCapUsd: 112_000_000 },
    ]
    const sanitized = sanitizeHeroMcapHistory(history)
    expect(sanitized[0]?.creatorCoinsMarketCapUsd).toBe(129_000_000)
    expect(sanitized[3]?.creatorCoinsMarketCapUsd).toBe(112_000_000)
    expect(sanitized[1]?.creatorCoinsMarketCapUsd).toBeCloseTo(
      129_000_000 + (112_000_000 - 129_000_000) * (1 / 3),
      0,
    )
    expect(sanitized[2]?.creatorCoinsMarketCapUsd).toBeCloseTo(
      129_000_000 + (112_000_000 - 129_000_000) * (2 / 3),
      0,
    )
  })

  it('leaves normal gradual moves alone', () => {
    const history = [
      { date: 'a', creatorCoinsMarketCapUsd: 100_000_000 },
      { date: 'b', creatorCoinsMarketCapUsd: 110_000_000 },
      { date: 'c', creatorCoinsMarketCapUsd: 125_000_000 },
    ]
    expect(sanitizeHeroMcapHistory(history)).toEqual(history)
  })
})
