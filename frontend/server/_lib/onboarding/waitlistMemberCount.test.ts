import { describe, expect, it, vi } from 'vitest'

import { getWaitlistMemberCount } from './waitlistLeaderboard'

describe('getWaitlistMemberCount', () => {
  it('counts only verified-email profiles that were not merged away', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = strings.join(' ').toLowerCase()
        expect(query).toContain('email is not null')
        expect(query).toContain('merged_into_profile_id is null')
        return { rows: [{ c: 1 }] }
      }),
    }

    await expect(getWaitlistMemberCount(db as any)).resolves.toBe(1)
    expect(db.sql).toHaveBeenCalledTimes(1)
  })

  it('returns 0 when the count query yields no rows', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    await expect(getWaitlistMemberCount(db as any)).resolves.toBe(0)
  })

  it('uses the same membership filter as leaderboard totalCount', async () => {
    const leaderboardQuery = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(' ').toLowerCase()
      if (query.includes('count(*)') && query.includes('merged_into_profile_id is null')) {
        return { rows: [{ c: 59 }] }
      }
      throw new Error(`unexpected query: ${query}`)
    })

    await expect(getWaitlistMemberCount({ sql: leaderboardQuery } as any)).resolves.toBe(59)
  })
})
