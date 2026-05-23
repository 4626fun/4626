import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('ensureCreatorMetricsSchema', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('runs column migrations when base tables already exist', async () => {
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join('?').trim()
      if (query.includes('to_regclass')) {
        return {
          rows: [{
            has_creator_coins: true,
            has_creators: true,
            has_state: true,
            has_daily: true,
          }],
        }
      }
      return { rows: [] }
    })

    const { ensureCreatorMetricsSchema } = await import('./creatorMetricsSync.js')
    await ensureCreatorMetricsSchema({ sql } as any)

    const alterCalls = sql.mock.calls.filter(([strings]) =>
      String(strings.join('?')).includes('ADD COLUMN IF NOT EXISTS cached_creators_total'),
    )
    expect(alterCalls.length).toBe(1)
  })
})
