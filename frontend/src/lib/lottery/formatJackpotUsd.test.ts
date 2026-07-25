import { describe, expect, it } from 'vitest'

import { formatJackpotUsdDisplay, fetchProtocolJackpotUsd } from './formatJackpotUsd'

describe('formatJackpotUsdDisplay', () => {
  it('formats positive USD amounts', () => {
    expect(formatJackpotUsdDisplay('1234')).toMatch(/\$1,234/)
    expect(formatJackpotUsdDisplay('12.34')).toMatch(/\$12\.34/)
  })

  it('returns null for empty or non-positive values', () => {
    expect(formatJackpotUsdDisplay(null)).toBeNull()
    expect(formatJackpotUsdDisplay('0')).toBeNull()
    expect(formatJackpotUsdDisplay('-1')).toBeNull()
    expect(formatJackpotUsdDisplay('nope')).toBeNull()
  })
})

describe('fetchProtocolJackpotUsd', () => {
  it('reads jackpotUsd from creator lottery stats', async () => {
    const value = await fetchProtocolJackpotUsd(async () =>
      new Response(JSON.stringify({ success: true, data: { jackpotUsd: '420.69' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(value).toBe('420.69')
  })

  it('returns null when the API fails', async () => {
    const value = await fetchProtocolJackpotUsd(async () =>
      new Response(JSON.stringify({ success: false, error: 'nope' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    expect(value).toBeNull()
  })
})
