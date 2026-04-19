import { describe, expect, it, vi } from 'vitest'

import {
  executeProfileMerge,
  planProfileMerge,
  ProfileMergeValidationError,
  type ProfileMergePlan,
} from './profileMerge'

type FakeDb = { sql: ReturnType<typeof vi.fn> }

function profileRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 0,
    email: null,
    privy_user_id: null,
    primary_wallet: null,
    embedded_wallet: null,
    csw_address: null,
    referral_code: null,
    merged_into_profile_id: null,
    ...over,
  }
}

describe('planProfileMerge validation', () => {
  function makeProfilesDb(profiles: Record<number, ReturnType<typeof profileRow> | null>): FakeDb {
    return {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (/FROM profiles\s+WHERE id =/i.test(raw)) {
          const id = Number(values[0])
          const row = profiles[id] ?? null
          return { rows: row ? [row] : [] }
        }
        // all counts default to 0
        return { rows: [{ c: 0 }] }
      }),
    }
  }

  it('rejects when from profile is missing', async () => {
    const db = makeProfilesDb({ 1: profileRow({ id: 1, email: 'a@b.co' }) })
    await expect(planProfileMerge(db as any, 999, 1)).rejects.toBeInstanceOf(ProfileMergeValidationError)
    await expect(planProfileMerge(db as any, 999, 1)).rejects.toThrow(/from_not_found/)
  })

  it('rejects when to profile is missing', async () => {
    const db = makeProfilesDb({ 1: profileRow({ id: 1, privy_user_id: 'x' }) })
    await expect(planProfileMerge(db as any, 1, 999)).rejects.toThrow(/to_not_found/)
  })

  it('rejects when from === to', async () => {
    const db = makeProfilesDb({ 1: profileRow({ id: 1, email: 'a@b.co' }) })
    await expect(planProfileMerge(db as any, 1, 1)).rejects.toThrow(/same_profile/)
  })

  it('rejects when to has no email (canonical identity invariant)', async () => {
    const db = makeProfilesDb({
      1: profileRow({ id: 1, email: null, privy_user_id: 'a' }),
      2: profileRow({ id: 2, email: null, privy_user_id: 'b' }),
    })
    await expect(planProfileMerge(db as any, 1, 2)).rejects.toThrow(/to_email_required/)
  })

  it('rejects when from is already tombstoned', async () => {
    const db = makeProfilesDb({
      1: profileRow({ id: 1, privy_user_id: 'a', merged_into_profile_id: 99 }),
      2: profileRow({ id: 2, email: 'a@b.co' }),
    })
    await expect(planProfileMerge(db as any, 1, 2)).rejects.toThrow(/from_already_merged/)
  })

  it('rejects when to is already tombstoned', async () => {
    const db = makeProfilesDb({
      1: profileRow({ id: 1, privy_user_id: 'a' }),
      2: profileRow({ id: 2, email: 'a@b.co', merged_into_profile_id: 99 }),
    })
    await expect(planProfileMerge(db as any, 1, 2)).rejects.toThrow(/to_already_merged/)
  })
})

describe('planProfileMerge success', () => {
  it('returns a plan with counts of rows that would move', async () => {
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (/FROM profiles\s+WHERE id =/i.test(raw)) {
          const id = Number(values[0])
          if (id === 1) {
            return { rows: [profileRow({ id: 1, privy_user_id: 'p1', primary_wallet: '0xabc' })] }
          }
          if (id === 2) {
            return { rows: [profileRow({ id: 2, email: 'user@example.com', privy_user_id: 'p2' })] }
          }
          return { rows: [] }
        }
        // Count queries. `strings.join` drops parameter placeholders, so
        // match on the disambiguating keyword (NOT EXISTS vs EXISTS, etc.).
        if (/FROM points p\b[\s\S]*\bNOT EXISTS/i.test(raw)) {
          return { rows: [{ c: 3 }] } // novel points rows to move
        }
        if (/FROM points p\b[\s\S]*\bAND EXISTS/i.test(raw)) {
          return { rows: [{ c: 1 }] } // duplicate
        }
        if (/FROM referral_conversions/i.test(raw)) return { rows: [{ c: 2 }] }
        if (/FROM profiles[\s\S]*referred_by_signup_id\s*=/i.test(raw)) {
          return { rows: [{ c: 0 }] }
        }
        return { rows: [{ c: 0 }] }
      }),
    }

    const plan = await planProfileMerge(db as any, 1, 2)
    expect(plan.from.id).toBe(1)
    expect(plan.to.id).toBe(2)
    expect(plan.to.email).toBe('user@example.com')
    expect(plan.pointsRowsToMove).toBe(3)
    expect(plan.pointsRowsSkippedAsDuplicate).toBe(1)
    expect(plan.referralConversionsToRepoint).toBe(2)
    expect(plan.refereesToRepoint).toBe(0)
  })
})

describe('executeProfileMerge', () => {
  it('writes alias, links wallets, moves points, repoints referrals, and tombstones from', async () => {
    type Counters = {
      aliasInserts: number
      walletInserts: number
      pointsInsertsReturned: number
      pointsDuplicateSelect: number
      pointsDeletes: number
      referralConversionsUpdates: number
      refereesUpdates: number
      tombstone: number
      fromRefCleared: number
      cswPropagate: number
      refCodeCopy: number
    }
    const c: Counters = {
      aliasInserts: 0,
      walletInserts: 0,
      pointsInsertsReturned: 0,
      pointsDuplicateSelect: 0,
      pointsDeletes: 0,
      referralConversionsUpdates: 0,
      refereesUpdates: 0,
      tombstone: 0,
      fromRefCleared: 0,
      cswPropagate: 0,
      refCodeCopy: 0,
    }

    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        // Re-validation loadProfile calls.
        if (/FROM profiles\s+WHERE id =/i.test(raw)) {
          const id = Number(values[0])
          if (id === 1) {
            return {
              rows: [
                profileRow({
                  id: 1,
                  privy_user_id: 'from-privy',
                  primary_wallet: '0x' + 'a'.repeat(40),
                  embedded_wallet: '0x' + 'b'.repeat(40),
                  csw_address: '0x' + 'c'.repeat(40),
                  referral_code: 'OLD',
                }),
              ],
            }
          }
          if (id === 2) {
            return { rows: [profileRow({ id: 2, email: 'canonical@example.com', privy_user_id: 'to-privy' })] }
          }
          return { rows: [] }
        }
        if (/INSERT INTO privy_user_aliases/i.test(raw)) {
          c.aliasInserts += 1
          return { rows: [{ privy_user_id: 'from-privy' }] }
        }
        if (/UPDATE profiles\s+SET csw_address/i.test(raw)) {
          c.cswPropagate += 1
          return { rows: [{ id: 2 }] }
        }
        if (/INSERT INTO profile_wallets/i.test(raw)) {
          c.walletInserts += 1
          return { rows: [{ profile_id: 2 }] }
        }
        if (/INSERT INTO points/i.test(raw)) {
          c.pointsInsertsReturned += 1
          // Return 4 rows to simulate 4 novel points moved in one statement.
          return { rows: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] }
        }
        if (/DELETE FROM points/i.test(raw)) {
          c.pointsDeletes += 1
          return { rows: [] }
        }
        if (/FROM points p\b[\s\S]*\bAND EXISTS/i.test(raw)) {
          c.pointsDuplicateSelect += 1
          return { rows: [{ c: 2 }] }
        }
        if (/UPDATE referral_conversions\s+SET referrer_signup_id/i.test(raw)) {
          c.referralConversionsUpdates += 1
          return { rows: [{ id: 1 }] }
        }
        if (/UPDATE referral_conversions\s+SET invitee_signup_id/i.test(raw)) {
          c.referralConversionsUpdates += 1
          return { rows: [] }
        }
        if (/UPDATE profiles\s+SET referred_by_signup_id/i.test(raw)) {
          c.refereesUpdates += 1
          return { rows: [{ id: 55 }, { id: 56 }] }
        }
        // Test CLEAR (unambiguous `= NULL`) BEFORE the generic copy matcher
        // so `= ${value}` can't match a CLEAR by regex backtracking.
        if (/UPDATE profiles\s+SET referral_code\s*=\s*NULL\b/i.test(raw)) {
          c.fromRefCleared += 1
          return { rows: [{ id: 1 }] }
        }
        if (/UPDATE profiles\s+SET referral_code\s*=/i.test(raw)) {
          c.refCodeCopy += 1
          return { rows: [{ id: 2 }] }
        }
        if (/UPDATE profiles\s+SET privy_user_id\s*=\s*NULL,\s+merged_into_profile_id/i.test(raw)) {
          c.tombstone += 1
          return { rows: [{ id: 1 }] }
        }
        return { rows: [] }
      }),
    }

    const plan: ProfileMergePlan = {
      from: {
        id: 1,
        email: null,
        privyUserId: 'from-privy',
        primaryWallet: '0x' + 'a'.repeat(40),
        embeddedWallet: '0x' + 'b'.repeat(40),
        cswAddress: '0x' + 'c'.repeat(40),
        referralCode: 'OLD',
        mergedIntoProfileId: null,
      },
      to: {
        id: 2,
        email: 'canonical@example.com',
        privyUserId: 'to-privy',
        primaryWallet: null,
        embeddedWallet: null,
        cswAddress: null,
        referralCode: null,
        mergedIntoProfileId: null,
      },
      pointsRowsToMove: 4,
      pointsRowsSkippedAsDuplicate: 2,
      referralConversionsToRepoint: 1,
      refereesToRepoint: 2,
    }

    const result = await executeProfileMerge(db as any, plan)

    expect(result.aliasInserted).toBe(true)
    expect(result.cswPropagated).toBe(true)
    expect(result.walletsLinked).toBe(2) // primary + embedded
    expect(result.pointsMoved).toBe(4)
    expect(result.pointsDroppedAsDuplicate).toBe(2)
    expect(result.referralConversionsRepointed).toBe(1)
    expect(result.refereesRepointed).toBe(2)
    expect(result.referralCodeCopied).toBe(true)
    expect(result.fromTombstoned).toBe(true)

    expect(c.pointsDeletes).toBe(1)
    expect(c.aliasInserts).toBe(1)
    expect(c.fromRefCleared).toBe(1)
    expect(c.tombstone).toBe(1)
  })

  it('preserves an existing csw_address on to (never overwrites canonical)', async () => {
    let cswAttempts = 0
    const db: FakeDb = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const raw = strings.join(' ')
        if (/FROM profiles\s+WHERE id =/i.test(raw)) {
          const id = Number(values[0])
          if (id === 1) return { rows: [profileRow({ id: 1, privy_user_id: 'from', csw_address: '0xffff' })] }
          if (id === 2) return { rows: [profileRow({ id: 2, email: 'x@y.co', csw_address: '0xaaaa' })] }
          return { rows: [] }
        }
        if (/UPDATE profiles\s+SET csw_address/i.test(raw)) {
          cswAttempts += 1
          return { rows: [] } // WHERE csw_address IS NULL filter excludes
        }
        if (/FROM points p\s+WHERE p\.signup_id = \$1\s+AND EXISTS/i.test(raw)) {
          return { rows: [{ c: 0 }] }
        }
        return { rows: [] }
      }),
    }

    const plan: ProfileMergePlan = {
      from: {
        id: 1,
        email: null,
        privyUserId: 'from',
        primaryWallet: null,
        embeddedWallet: null,
        cswAddress: '0xffff',
        referralCode: null,
        mergedIntoProfileId: null,
      },
      to: {
        id: 2,
        email: 'x@y.co',
        privyUserId: 'to',
        primaryWallet: null,
        embeddedWallet: null,
        cswAddress: '0xaaaa',
        referralCode: null,
        mergedIntoProfileId: null,
      },
      pointsRowsToMove: 0,
      pointsRowsSkippedAsDuplicate: 0,
      referralConversionsToRepoint: 0,
      refereesToRepoint: 0,
    }

    const result = await executeProfileMerge(db as any, plan)
    expect(cswAttempts).toBe(0) // guard prevented the UPDATE entirely
    expect(result.cswPropagated).toBe(false)
  })
})
