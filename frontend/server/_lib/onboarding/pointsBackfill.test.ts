import { describe, expect, it, vi } from 'vitest'

import {
  applyPassthroughs,
  applyTopups,
  CANONICAL_POINT_VALUES,
  executePointsBackfill,
  planPointsBackfill,
  type BackfillPlan,
  type PassthroughCandidate,
  type TopupCandidate,
} from './pointsBackfill'

type FakeDb = {
  sql: ReturnType<typeof vi.fn>
}

function isSelectPointsForTopup(raw: string): boolean {
  return /select\s+p\.id,\s*p\.signup_id,\s*p\.amount/i.test(raw)
}

function isPassthroughBackfillSelect(raw: string): boolean {
  return /select\s+p\.id,\s*p\.signup_id\s+as\s+referee_signup_id/i.test(raw)
}

function isObservedSourcesSelect(raw: string): boolean {
  return /select\s+distinct\s+source\s+from\s+points/i.test(raw)
}

function isMissingBaselineSelect(raw: string): boolean {
  return /select\s+p\.id\s+as\s+signup_id/i.test(raw) && /not\s+exists/i.test(raw)
}

function isInsertPoints(raw: string): boolean {
  return /insert\s+into\s+points/i.test(raw)
}

function isProfilesReferrerLookup(raw: string): boolean {
  return /from\s+profiles\s*\n?\s*where\s+id\s*=/i.test(raw)
}

describe('planPointsBackfill', () => {
  it('returns only rows below canonical value and reports per-source deltas', async () => {
    // Simulate: three rows, one below canonical (csw_link amount=10, target=50),
    // one at canonical (social_x amount=2), one above canonical (hypothetical).
    // Only the below-target row should become a candidate.
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (isSelectPointsForTopup(raw)) {
          const [source] = values
          if (source === 'csw_link') {
            return { rows: [{ id: 101, signup_id: 1, amount: 10 }] }
          }
          return { rows: [] }
        }
        if (isPassthroughBackfillSelect(raw)) return { rows: [] }
        if (isObservedSourcesSelect(raw)) {
          return {
            rows: [
              { source: 'csw_link' },
              { source: 'social_x' },
              { source: 'totally_unknown' },
            ],
          }
        }
        return { rows: [] }
      }),
    }

    const plan = await planPointsBackfill(db as any)

    expect(plan.topups).toHaveLength(1)
    expect(plan.topups[0]).toMatchObject({
      originalRowId: 101,
      signupId: 1,
      source: 'csw_link',
      currentAmount: 10,
      targetAmount: 50,
      delta: 40,
    })
    expect(plan.topupsBySource.csw_link).toEqual({ count: 1, totalDelta: 40 })
    expect(plan.passthroughs).toHaveLength(0)
    expect(plan.unknownSourcesObserved).toContain('totally_unknown')
    expect(plan.unknownSourcesObserved).not.toContain('csw_link')
  })

  it('passes the exempt sources array to the passthrough backfill select', async () => {
    let observedValues: any[] | null = null
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (isSelectPointsForTopup(raw)) return { rows: [] }
        if (isPassthroughBackfillSelect(raw)) {
          observedValues = values
          return { rows: [] }
        }
        if (isObservedSourcesSelect(raw)) return { rows: [] }
        return { rows: [] }
      }),
    }

    await planPointsBackfill(db as any)

    expect(observedValues).toBeTruthy()
    // First param of the passthrough query is the exempt-array, passed as a
    // PG `text[]` parameter. Verify all four referral-family sources are in it.
    const arrayParam = observedValues?.[0]
    expect(Array.isArray(arrayParam)).toBe(true)
    for (const source of [
      'referral_passthrough',
      'referral_signup',
      'referral_csw_link',
      'referral_qualified',
    ]) {
      expect(arrayParam).toContain(source)
    }
  })

  it('respects the `limit` option across top-up sources', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (isSelectPointsForTopup(raw)) {
          // Return one row per source queried, regardless of the SQL LIMIT,
          // so we can confirm the JS-side stop works.
          const [source] = values
          return {
            rows: [{ id: Number(Math.random() * 1_000_000) | 0, signup_id: 1, amount: 0 }],
          }
        }
        if (isPassthroughBackfillSelect(raw)) return { rows: [] }
        if (isObservedSourcesSelect(raw)) return { rows: [] }
        return { rows: [] }
      }),
    }

    const plan = await planPointsBackfill(db as any, { limit: 3 })
    expect(plan.topups).toHaveLength(3)
  })
})

describe('applyTopups', () => {
  it('inserts one row per candidate with source_id = "topup:<id>" and amount = delta', async () => {
    const inserts: Array<{ signupId: unknown; source: unknown; sourceId: unknown; amount: unknown }> = []
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (isInsertPoints(raw)) {
          inserts.push({
            signupId: values[0],
            source: values[1],
            sourceId: values[2],
            amount: values[3],
          })
          return { rows: [{ id: inserts.length }] }
        }
        return { rows: [] }
      }),
    }

    const plan: TopupCandidate[] = [
      {
        originalRowId: 101,
        signupId: 1,
        source: 'csw_link',
        currentAmount: 10,
        targetAmount: 50,
        delta: 40,
      },
      {
        originalRowId: 202,
        signupId: 2,
        source: 'link_email',
        currentAmount: 0,
        targetAmount: 10,
        delta: 10,
      },
    ]
    const inserted = await applyTopups(db as any, plan)

    expect(inserted).toBe(2)
    expect(inserts).toHaveLength(2)
    expect(inserts[0]).toMatchObject({
      signupId: 1,
      source: 'csw_link',
      sourceId: 'topup:101',
      amount: 40,
    })
    expect(inserts[1]).toMatchObject({
      signupId: 2,
      source: 'link_email',
      sourceId: 'topup:202',
      amount: 10,
    })
  })

  it('counts rows where ON CONFLICT DO NOTHING absorbed the insert', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        if (isInsertPoints(raw)) return { rows: [] } // simulate ON CONFLICT no-op
        return { rows: [] }
      }),
    }

    const plan: TopupCandidate[] = [
      {
        originalRowId: 1,
        signupId: 1,
        source: 'csw_link',
        currentAmount: 10,
        targetAmount: 50,
        delta: 40,
      },
    ]
    const inserted = await applyTopups(db as any, plan)
    expect(inserted).toBe(0)
  })
})

describe('applyPassthroughs', () => {
  it('delegates to recordReferralPassthrough per candidate and counts outcomes', async () => {
    // We can't easily mock the dynamic-import-free call, so exercise through
    // a fake DB that makes `recordReferralPassthrough` hit its short-circuits.
    // When the referee profile has no referrer, the helper returns false.
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        if (isProfilesReferrerLookup(raw)) return { rows: [] } // no referrer
        return { rows: [] }
      }),
    }

    const plan: PassthroughCandidate[] = [
      {
        refereeRowId: 1,
        refereeSignupId: 99,
        referrerSignupId: 42,
        source: 'waitlist_signup',
        sourceId: 'seed',
        amount: 5,
      },
    ]
    const { inserted, skipped } = await applyPassthroughs(db as any, plan)
    expect(inserted).toBe(0)
    expect(skipped).toBe(1)
  })
})

describe('executePointsBackfill', () => {
  it('fires passthroughs for both the original and top-up rows in one pass', async () => {
    // Count profile lookups and INSERTs; top-up row triggers its own
    // passthrough query, so we expect a profile lookup per top-up AND per
    // Phase-B passthrough candidate.
    let profileLookups = 0
    let pointsInserts = 0
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ')
        if (isProfilesReferrerLookup(raw)) {
          profileLookups += 1
          return { rows: [] } // no referrer, helper no-ops
        }
        if (isInsertPoints(raw)) {
          pointsInserts += 1
          return { rows: [{ id: pointsInserts }] }
        }
        return { rows: [] }
      }),
    }

    const plan: BackfillPlan = {
      topups: [
        {
          originalRowId: 101,
          signupId: 1,
          source: 'csw_link',
          currentAmount: 10,
          targetAmount: 50,
          delta: 40,
        },
      ],
      passthroughs: [
        {
          refereeRowId: 202,
          refereeSignupId: 2,
          referrerSignupId: 99,
          source: 'waitlist_signup',
          sourceId: 'seed',
          amount: 5,
        },
      ],
      missingBaselines: [],
      missingLinkEmails: [],
      unknownSourcesObserved: [],
      topupsBySource: { csw_link: { count: 1, totalDelta: 40 } },
    }

    const result = await executePointsBackfill(db as any, plan)

    // One INSERT for the top-up row itself.
    expect(pointsInserts).toBe(1)
    expect(result.topupsInserted).toBe(1)
    // Two profile lookups: one for phase B's original passthrough, one for
    // the top-up's synthetic passthrough. Both no-op (no referrer).
    expect(profileLookups).toBe(2)
    expect(result.passthroughsInserted).toBe(0)
    expect(result.passthroughsSkipped).toBe(2)
    expect(result.baselinesInserted).toBe(0)
    expect(result.linkEmailsInserted).toBe(0)
  })

  it('mints missing waitlist_signup baselines via awardWaitlistPoints', async () => {
    // Simulate three profiles that lack a waitlist_signup row. The
    // `awardWaitlistPoints` path does (for non-csw sources): one INSERT,
    // then (on successful insert) one profile SELECT for passthrough.
    // All profiles here have no referrer, so passthrough no-ops.
    let inserts = 0
    let profileLookups = 0
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const raw = strings.join(' ').toLowerCase()
        if (raw.includes('from profiles') && raw.includes('referred_by_signup_id')) {
          profileLookups += 1
          return { rows: [] }
        }
        if (raw.includes('insert into points')) {
          inserts += 1
          return { rows: [{ id: inserts }] }
        }
        return { rows: [] }
      }),
    }

    const plan: BackfillPlan = {
      topups: [],
      passthroughs: [],
      missingBaselines: [{ signupId: 10 }, { signupId: 11 }, { signupId: 12 }],
      missingLinkEmails: [],
      unknownSourcesObserved: [],
      topupsBySource: {},
    }
    const result = await executePointsBackfill(db as any, plan)

    expect(inserts).toBe(3)
    expect(profileLookups).toBe(3)
    expect(result.baselinesInserted).toBe(3)
    expect(result.topupsInserted).toBe(0)
    expect(result.passthroughsInserted).toBe(0)
    expect(result.linkEmailsInserted).toBe(0)
  })
})

describe('CANONICAL_POINT_VALUES', () => {
  it('is even-integer for the high-value sources where passthrough mirroring matters', () => {
    // AGENTS.md contract: referral passthrough floors the 50% mirror, so
    // the economy-relevant awards (CSW-link and identity links) must be
    // even integers for the referrer split to stay exact. Dust-level
    // sources (values 1–5, one-off micro-bonuses) are allowed to be odd
    // — their half-point is acceptable and in some cases intentional
    // (value of 1 floors the mirror to 0, suppressing passthrough on
    // honor-system points).
    const HIGH_VALUE_SOURCES = [
      'csw_link',
      'link_email',
      'link_google',
      'link_apple',
      'link_external_eoa',
      'link_twitter',
      'link_telegram',
      'link_tiktok',
      'link_zora',
      'amoe_checkin',
    ] as const
    for (const source of HIGH_VALUE_SOURCES) {
      const value = CANONICAL_POINT_VALUES[source]
      expect(value, `${source} must be defined`).toBeGreaterThan(0)
      expect(value % 2, `${source} must be even (got ${value})`).toBe(0)
    }
  })

  it('includes all primary link_* sources written by accountsIdentity.ts', () => {
    for (const source of [
      'link_email',
      'link_google',
      'link_apple',
      'link_external_eoa',
      'link_twitter',
      'link_telegram',
      'link_tiktok',
      'link_zora',
    ]) {
      expect(CANONICAL_POINT_VALUES[source], `missing canonical for ${source}`).toBeGreaterThan(0)
    }
  })

  it('does not include any referral_* source (those are exempt from top-up)', () => {
    for (const source of Object.keys(CANONICAL_POINT_VALUES)) {
      expect(source.startsWith('referral_')).toBe(false)
    }
  })
})
