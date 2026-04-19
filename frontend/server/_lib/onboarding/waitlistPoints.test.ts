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
    // Mock responds to three sequential queries:
    //   1. SELECT csw_link cap check (empty → proceed)
    //   2. INSERT points
    //   3. SELECT profiles.referred_by_signup_id (empty → no passthrough insert)
    let insertCount = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from points') && query.includes("source = 'csw_link'")) {
          return { rows: [] }
        }
        if (query.includes('insert into points')) {
          insertCount += 1
          return { rows: [{ id: insertCount }] }
        }
        if (query.includes('from profiles') && query.includes('referred_by_signup_id')) {
          return { rows: [] }
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
    // 1 cap-check SELECT + 1 INSERT (referee award) + 1 passthrough
    // SELECT (finds no referrer → no passthrough insert).
    expect(db.sql).toHaveBeenCalledTimes(3)
    const insertArgs = db.sql.mock.calls[1] ?? []
    const insertValues = insertArgs.slice(1)
    expect(insertValues).toContain(null)
  })

  it('mirrors 50% of a referee award to their referrer via passthrough', async () => {
    // Signup 99 earns 10 points; signup 42 is their referrer.
    // Expected sequence:
    //   1. SELECT csw_link cap (empty)
    //   2. INSERT referee points (10)
    //   3. SELECT referred_by_signup_id for 99 → { referred_by_signup_id: 42 }
    //   4. INSERT referrer passthrough points (5)
    type InsertRecord = { kind: 'referee' | 'passthrough'; signupId: unknown; amount: unknown }
    const inserts: InsertRecord[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        const query = raw.toLowerCase()
        if (query.includes('from points') && query.includes("source = 'csw_link'")) {
          return { rows: [] }
        }
        if (query.includes('from profiles') && query.includes('referred_by_signup_id')) {
          return { rows: [{ referred_by_signup_id: 42 }] }
        }
        if (query.includes('insert into points')) {
          // Two different INSERT templates exist:
          //   - referee award: VALUES ($signupId, $source, $sourceId, $amount, NOW())
          //     → values[0]=signupId, values[3]=amount
          //   - passthrough:   VALUES ($signupId, 'referral_passthrough', $sourceKey, $amount, NOW())
          //     → source is a literal, values[0]=signupId, values[2]=amount
          const isPassthrough = raw.includes("'referral_passthrough'")
          inserts.push({
            kind: isPassthrough ? 'passthrough' : 'referee',
            signupId: values[0],
            amount: isPassthrough ? values[2] : values[3],
          })
          return { rows: [{ id: inserts.length }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardWaitlistPoints({
      db: db as any,
      signupId: 99,
      source: 'csw_link',
      sourceId: 'csw:0xbeef',
      amount: 10,
    })

    expect(awarded).toBe(true)
    expect(inserts).toHaveLength(2)
    expect(inserts[0]).toMatchObject({ kind: 'referee', signupId: 99, amount: 10 })
    expect(inserts[1]).toMatchObject({ kind: 'passthrough', signupId: 42, amount: 5 })
  })

  it('skips passthrough when the award source is referral-family', async () => {
    // Even with a referrer configured, awarding a `referral_*` event
    // must NOT trigger another passthrough. This prevents cascades.
    let profileSelects = 0
    const inserts: Array<{ amount: unknown }> = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from profiles') && query.includes('referred_by_signup_id')) {
          profileSelects += 1
          return { rows: [{ referred_by_signup_id: 42 }] }
        }
        if (query.includes('insert into points')) {
          inserts.push({ amount: values[3] })
          return { rows: [{ id: inserts.length }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardWaitlistPoints({
      db: db as any,
      signupId: 99,
      source: 'referral_qualified',
      sourceId: 'invitee:5',
      amount: 6,
    })

    expect(awarded).toBe(true)
    // Passthrough helper short-circuits before querying the referrer,
    // so the profiles lookup must not happen.
    expect(profileSelects).toBe(0)
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ amount: 6 })
  })
})
