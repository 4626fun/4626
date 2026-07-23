import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetWaitlistLeaderboardCacheForTests,
  __waitlistLeaderboardCacheSizeForTests,
  getWaitlistLeaderboardData,
} from './waitlistLeaderboard.js'

describe('public waitlist leaderboard wallet privacy', () => {
  afterEach(() => __resetWaitlistLeaderboardCacheForTests())

  it('preserves canonical CSWs and external EOAs while excluding embedded signer identities', async () => {
    const rankedQueries: string[] = []
    let rankedQueryCount = 0
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join('?').replace(/\s+/g, ' ').trim().toLowerCase()
        if (sql.includes('select count(*)::int as c')) return { rows: [{ c: 3 }] }
        if (sql.includes('from ranked')) {
          rankedQueries.push(sql)
          rankedQueryCount += 1
          return {
            rows: rankedQueryCount === 1 ? [
              {
                rank: 1,
                signup_id: 42,
                canonical_csw: '0x00000000000000000000000000000000000000cc',
                eoa_address: null,
                referral_code: 'CSW',
                total_points: 1,
                invite_points: 0,
                agent_points: 0,
                border_tier: 0,
              },
              {
                rank: 2,
                signup_id: 43,
                canonical_csw: null,
                eoa_address: '0x00000000000000000000000000000000000000ee',
                referral_code: 'EOA',
                total_points: 1,
                invite_points: 0,
                agent_points: 0,
                border_tier: 0,
              },
              {
                rank: 3,
                signup_id: 44,
                canonical_csw: null,
                eoa_address: null,
                referral_code: 'SIGNER',
                total_points: 1,
                invite_points: 0,
                agent_points: 0,
                border_tier: 0,
              },
            ] : [{
              rank: 3,
              signup_id: 44,
              canonical_csw: null,
              eoa_address: null,
              referral_code: 'SIGNER',
              total_points: 1,
              invite_points: 0,
              agent_points: 0,
              border_tier: 0,
            }],
          }
        }
        return { rows: [] }
      }),
    }

    const result = await getWaitlistLeaderboardData({
      db,
      page: 1,
      limit: 10,
      pointsType: 'total',
      authorizedProfileId: 44,
    })

    expect(rankedQueries).toHaveLength(2)
    for (const sql of rankedQueries) {
      expect(sql).toContain(
        'lower(trim(p.primary_wallet)) <> lower(trim(p.primary_embedded_eoa))',
      )
      expect(sql).toContain('lower(trim(p.primary_wallet)) <> lower(trim(p.embedded_wallet))')
      expect(sql).toContain('else null end as primary_wallet_raw')
      expect(sql).not.toContain(
        "coalesce( nullif(trim(p.csw_address), ''), case when nullif(trim(p.csw_address), '')",
      )
    }
    expect(result.leaderboard[0]).toMatchObject({
      cswAddress: '0x00000000000000000000000000000000000000cc',
      eoaAddress: null,
    })
    expect(result.leaderboard[1]).toMatchObject({
      cswAddress: null,
      eoaAddress: '0x00000000000000000000000000000000000000ee',
    })
    expect(result.leaderboard[2]?.display).toBe('user#44')
    expect(result.leaderboard[2]?.cswAddress).toBeNull()
    expect(result.leaderboard[2]?.eoaAddress).toBeNull()
    expect(result.leaderboard[0]?.eoaAddress).toBeNull()
    expect(result.me?.eoaAddress).toBeNull()
  })

  it('bounds attacker-controlled page cache cardinality', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const sql = strings.join(' ').toLowerCase()
        if (sql.includes('count(*)')) return { rows: [{ c: 1 }] }
        return { rows: [] }
      }),
    }
    for (let page = 1; page <= 300; page += 1) {
      await getWaitlistLeaderboardData({
        db,
        page,
        limit: 1,
        pointsType: 'total',
        authorizedProfileId: null,
      })
    }
    expect(__waitlistLeaderboardCacheSizeForTests()).toBeLessThanOrEqual(256)
  })
})
