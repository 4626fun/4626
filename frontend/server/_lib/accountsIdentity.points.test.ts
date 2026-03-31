import { describe, expect, it, vi } from 'vitest'

import { applyPointEvent } from './accountsIdentity'

describe('accounts identity points ledger', () => {
  it('awards each event_key only once', async () => {
    const pointsLedger = new Map<string, number>()

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const query = strings
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase()

        if (query.includes('select id from profiles') && query.includes('where privy_user_id')) {
          return { rows: [{ id: 101 }] }
        }

        if (query.includes('insert into points')) {
          const signupId = Number(values[0] ?? 0)
          const source = String(values[1] ?? '').toLowerCase()
          const sourceId = String(values[2] ?? '').toLowerCase()
          const amount = Number(values[3] ?? 0) || 0
          const key = `${signupId}:${source}:${sourceId}`
          if (pointsLedger.has(key)) return { rows: [] }
          pointsLedger.set(key, amount)
          return { rows: [{ id: 'pt-1' }] }
        }

        if (query.includes('from points p') && query.includes('where p.signup_id in')) {
          let total = 0
          for (const amount of pointsLedger.values()) {
            total += amount
          }
          return { rows: [{ points: total }] }
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
    expect(first.score.points).toBeGreaterThanOrEqual(0)
    expect(second.score.points).toBeGreaterThanOrEqual(0)
    expect(third.score.points).toBeGreaterThanOrEqual(0)
  })
})
