import { beforeEach, describe, expect, it, vi } from 'vitest'

const { readWaitlistPositionForSignupIdMock, readWaitlistPointsBreakdownMock, listPointsActivityForSignupIdMock } =
  vi.hoisted(() => ({
    readWaitlistPositionForSignupIdMock: vi.fn(),
    readWaitlistPointsBreakdownMock: vi.fn(),
    listPointsActivityForSignupIdMock: vi.fn(),
  }))

vi.mock('./waitlistPositionForProfile.js', () => ({
  readWaitlistPositionForSignupId: readWaitlistPositionForSignupIdMock,
}))

vi.mock('./waitlistScoring.js', () => ({
  readWaitlistPointsBreakdown: readWaitlistPointsBreakdownMock,
  listPointsActivityForSignupId: listPointsActivityForSignupIdMock,
}))

import {
  assertValidSignupId,
  buildAccountTrayPointsPayload,
  clampAccountTrayPointsActivityLimit,
} from './accountTrayPoints'

const baseSnapshot = {
  signupId: 7,
  profileCompletedAt: null,
  referralCode: null,
  borderTier: 0,
  points: { total: 10, invite: 0, signup: 10, tasks: 0, csw: 0, social: 0, bonus: 0 },
  tier: 0,
  rank: { invite: 2, total: 3 },
  totalCount: 99,
  totalAheadInvite: 1,
  percentileInvite: 5,
  referrals: { qualifiedCount: 0, pendingCount: 0, pendingCountCapped: 0, pendingCap: 10 },
}

const baseBreakdown = {
  total: 10,
  invite: 0,
  signup: 10,
  tasks: 0,
  csw: 0,
  social: 0,
  bonus: 0,
}

function createDb(email: string | null) {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase()
      if (text.includes('merged_into_profile_id') && text.includes('where id =')) {
        return { rows: [{ email, merged_into_profile_id: null }] }
      }
      return { rows: [] }
    }),
  }
}

describe('accountTrayPoints helpers', () => {
  it('clampAccountTrayPointsActivityLimit bounds input', () => {
    expect(clampAccountTrayPointsActivityLimit(undefined)).toBe(40)
    expect(clampAccountTrayPointsActivityLimit(0)).toBe(1)
    expect(clampAccountTrayPointsActivityLimit(999)).toBe(100)
    expect(clampAccountTrayPointsActivityLimit('12')).toBe(12)
  })

  it('assertValidSignupId rejects invalid ids', () => {
    expect(() => assertValidSignupId(0)).toThrow('invalid_signup_id')
    expect(() => assertValidSignupId(1.5)).toThrow('invalid_signup_id')
    expect(assertValidSignupId(42)).toBe(42)
  })
})

describe('buildAccountTrayPointsPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readWaitlistPositionForSignupIdMock.mockResolvedValue(baseSnapshot)
    readWaitlistPointsBreakdownMock.mockResolvedValue(baseBreakdown)
    listPointsActivityForSignupIdMock.mockResolvedValue([])
  })

  it('withholds rank for synthetic shell emails', async () => {
    const payload = await buildAccountTrayPointsPayload(createDb('shell@wallet.4626.fun') as any, 7, 20)
    expect(payload.leaderboardEligible).toBe(false)
    expect(payload.rank).toEqual({ invite: null, total: null })
    expect(payload.totalCount).toBe(0)
  })

  it('returns rank for verified email profiles', async () => {
    const payload = await buildAccountTrayPointsPayload(createDb('user@proton.me') as any, 7, 20)
    expect(payload.leaderboardEligible).toBe(true)
    expect(payload.rank.total).toBe(3)
    expect(payload.totalCount).toBe(99)
  })

  it('throws on breakdown mismatch (integrity guard)', async () => {
    readWaitlistPointsBreakdownMock.mockResolvedValueOnce({ ...baseBreakdown, total: 11 })
    await expect(buildAccountTrayPointsPayload(createDb('user@proton.me') as any, 7, 20)).rejects.toThrow(
      'account_tray_points_breakdown_mismatch',
    )
  })
})
