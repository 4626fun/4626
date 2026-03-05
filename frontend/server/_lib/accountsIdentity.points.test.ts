import { describe, expect, it, vi } from 'vitest'

import { applyPointEvent } from './accountsIdentity'

describe('accounts identity points ledger', () => {
  it('awards each event_key only once', async () => {
    const events = new Map<string, number>()

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const query = strings
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()

        if (query.includes('insert into account_point_events')) {
          const privyUserId = String(values[0] ?? '')
          const eventKey = String(values[2] ?? '').toLowerCase()
          const points = Number(values[3] ?? 0) || 0
          const key = `${privyUserId}:${eventKey}`
          if (events.has(key)) return { rows: [] }
          events.set(key, points)
          return { rows: [{ id: 'evt-1' }] }
        }

        if (query.includes('select coalesce(sum(points), 0)::int as points from account_point_events')) {
          const privyUserId = String(values[0] ?? '')
          let total = 0
          for (const [key, amount] of events.entries()) {
            if (key.startsWith(`${privyUserId}:`)) total += amount
          }
          return { rows: [{ points: total }] }
        }

        if (query.includes('insert into account_points')) {
          return { rows: [] }
        }

        return { rows: [] }
      }),
    }

    const first = await applyPointEvent({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      eventType: 'link_zora',
      eventKey: 'link_zora',
      points: 40,
    })
    const second = await applyPointEvent({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      eventType: 'link_zora',
      eventKey: 'link_zora',
      points: 40,
    })
    const third = await applyPointEvent({
      db: db as any,
      privyUserId: 'did:privy:test-user',
      eventType: 'resolve_csw',
      eventKey: 'resolve_csw:0x1111111111111111111111111111111111111111',
      points: 10,
    })

    expect(first.awarded).toBe(true)
    expect(second.awarded).toBe(false)
    expect(third.awarded).toBe(true)

    expect(first.score.points).toBe(40)
    expect(second.score.points).toBe(40)
    expect(third.score.points).toBe(50)
  })
})

