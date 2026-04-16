import { describe, expect, it, vi } from 'vitest'

import { awardWaitlistPoints, isWaitlistPointSource } from './waitlistPoints'

describe('waitlist points source hardening', () => {
  it('accepts referral_qualified as a valid source', () => {
    expect(isWaitlistPointSource('referral_qualified')).toBe(true)
  })

  it('rejects unknown sources in awardWaitlistPoints', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    await expect(
      awardWaitlistPoints({
        db: db as any,
        signupId: 1,
        source: 'unknown_source',
        sourceId: 'x',
        amount: 1,
      }),
    ).rejects.toThrow('invalid_waitlist_point_source')
  })

  it('blocks repeat csw_link awards once a csw_link row already exists', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from points') && query.includes("source = 'csw_link'")) {
          return { rows: [{ exists: 1 }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardWaitlistPoints({
      db: db as any,
      signupId: 42,
      source: 'csw_link',
      sourceId: 'csw:0xabc',
      amount: 10,
    })

    expect(awarded).toBe(false)
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  it('stores csw_link rows with null source_id for single-shot uniqueness', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from points') && query.includes("source = 'csw_link'")) {
          return { rows: [] }
        }
        if (query.includes('insert into points')) {
          return { rows: [{ id: 1 }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardWaitlistPoints({
      db: db as any,
      signupId: 99,
      source: 'csw_link',
      sourceId: 'csw:0xdef',
      amount: 10,
    })

    expect(awarded).toBe(true)
    expect(db.sql).toHaveBeenCalledTimes(2)
    const insertArgs = db.sql.mock.calls[1] ?? []
    const insertValues = insertArgs.slice(1)
    expect(insertValues).toContain(null)
  })
})
