import { describe, expect, it, vi } from 'vitest'

import {
  awardWaitlistPoints,
  buildPassthroughSourceKey,
  isWaitlistPointSource,
  recordReferralPassthrough,
} from './waitlistPoints'

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

  it.each([
    'referral_passthrough',
    'referral_signup',
    'referral_csw_link',
    'referral_qualified',
  ] as const)('blocks cascade for exempt source %s', async (source) => {
    let profileSelects = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from profiles') && query.includes('referred_by_signup_id')) {
          profileSelects += 1
          return { rows: [{ referred_by_signup_id: 42 }] }
        }
        return { rows: [] }
      }),
    }

    const mirrored = await recordReferralPassthrough({
      db: db as any,
      refereeSignupId: 99,
      originalSource: source,
      originalSourceId: 'x',
      amount: 100,
    })

    expect(mirrored).toBe(false)
    expect(profileSelects).toBe(0)
  })

  it('rejects non-integer signupId in awardWaitlistPoints', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    await expect(
      awardWaitlistPoints({
        db: db as any,
        signupId: 1.5,
        source: 'waitlist_signup',
        amount: 5,
      }),
    ).rejects.toThrow('invalid_waitlist_point_signup_id')
  })

  it('rejects amount above MAX_AWARD_AMOUNT in awardWaitlistPoints', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    await expect(
      awardWaitlistPoints({
        db: db as any,
        signupId: 1,
        source: 'waitlist_signup',
        amount: 999_999,
      }),
    ).rejects.toThrow('invalid_waitlist_point_amount')
  })

  it('recordReferralPassthrough rejects non-integer refereeSignupId', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    const mirrored = await recordReferralPassthrough({
      db: db as any,
      refereeSignupId: 1.5,
      originalSource: 'waitlist_signup',
      originalSourceId: 'x',
      amount: 10,
    })
    expect(mirrored).toBe(false)
    expect(db.sql).not.toHaveBeenCalled()
  })

  it('recordReferralPassthrough rejects amount above MAX_AWARD_AMOUNT', async () => {
    const db = { sql: vi.fn(async () => ({ rows: [] })) }
    const mirrored = await recordReferralPassthrough({
      db: db as any,
      refereeSignupId: 99,
      originalSource: 'waitlist_signup',
      originalSourceId: 'x',
      amount: 999_999,
    })
    expect(mirrored).toBe(false)
    expect(db.sql).not.toHaveBeenCalled()
  })

  it('recordReferralPassthrough no-ops when referee has no referrer', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from profiles')) return { rows: [] }
        return { rows: [] }
      }),
    }
    const mirrored = await recordReferralPassthrough({
      db: db as any,
      refereeSignupId: 99,
      originalSource: 'waitlist_signup',
      originalSourceId: 'x',
      amount: 10,
    })
    expect(mirrored).toBe(false)
    // Exactly one SELECT, zero INSERTs.
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  it('recordReferralPassthrough no-ops on self-referral', async () => {
    const inserts: unknown[] = []
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        if (query.includes('from profiles')) {
          // profiles row lists the referee as their own referrer
          return { rows: [{ referred_by_signup_id: 99 }] }
        }
        if (query.includes('insert into points')) {
          inserts.push('unexpected')
        }
        return { rows: [] }
      }),
    }
    const mirrored = await recordReferralPassthrough({
      db: db as any,
      refereeSignupId: 99,
      originalSource: 'waitlist_signup',
      originalSourceId: 'x',
      amount: 10,
    })
    expect(mirrored).toBe(false)
    expect(inserts).toHaveLength(0)
  })

  it('passthrough failure does not block the referee award and is logged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let insertCount = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        const query = raw.toLowerCase()
        if (query.includes('from points') && query.includes("source = 'csw_link'")) {
          return { rows: [] }
        }
        if (query.includes('from profiles')) {
          throw new Error('boom_profiles_select')
        }
        if (query.includes('insert into points')) {
          insertCount += 1
          return { rows: [{ id: insertCount }] }
        }
        return { rows: [] }
      }),
    }

    const awarded = await awardWaitlistPoints({
      db: db as any,
      signupId: 99,
      source: 'waitlist_signup',
      sourceId: 'tx:1',
      amount: 10,
    })

    expect(awarded).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      'waitlist_points.passthrough_failed',
      expect.objectContaining({
        refereeSignupId: 99,
        source: 'waitlist_signup',
        message: 'boom_profiles_select',
      }),
    )
    warn.mockRestore()
  })

  describe('buildPassthroughSourceKey', () => {
    it('returns the natural composite when it fits', () => {
      const key = buildPassthroughSourceKey(42, 'waitlist_signup', 'short-id')
      expect(key).toBe('42:waitlist_signup:short-id')
    })

    it('stays within MAX_SOURCE_KEY_LEN and is collision-resistant for long ids', () => {
      const longA = 'a'.repeat(500)
      const longB = longA.slice(0, -1) + 'b'
      const keyA = buildPassthroughSourceKey(42, 'waitlist_signup', longA)
      const keyB = buildPassthroughSourceKey(42, 'waitlist_signup', longB)
      expect(keyA).not.toBe(keyB)
      expect(keyA.length).toBeLessThanOrEqual(256)
      expect(keyB.length).toBeLessThanOrEqual(256)
      // Both keys end with a sha256-hex suffix separated by '#'
      expect(keyA).toMatch(/#[0-9a-f]{64}$/)
      expect(keyB).toMatch(/#[0-9a-f]{64}$/)
    })

    it('treats null and empty source_id equivalently', () => {
      expect(buildPassthroughSourceKey(1, 'waitlist_signup', null)).toBe('1:waitlist_signup:')
      expect(buildPassthroughSourceKey(1, 'waitlist_signup', '')).toBe('1:waitlist_signup:')
    })
  })
})
