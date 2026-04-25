import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('alfaclub vigilante — vercel wiring', () => {
  it('frontend/vercel.json registers the daily cron for /api/v1/alfaclub/run', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    const entry = (parsed.crons ?? []).find((c) => c.path === '/api/v1/alfaclub/run')
    expect(entry).toBeDefined()
    expect(entry?.schedule).toBe('0 12 * * *')
  })

  it('frontend/vercel.json registers the radar cron after the daily run', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    const entry = (parsed.crons ?? []).find((c) => c.path === '/api/v1/alfaclub/radar')
    expect(entry).toBeDefined()
    expect(entry?.schedule).toBe('5 12 * * *')
  })

  it('v1 route map exposes alfaclub/leaderboard, run, radar, compare, relay-now, chat-token', async () => {
    const src = await readFile(
      new URL('../_handlers/_routes.v1.ts', import.meta.url),
      'utf8',
    )
    expect(src).toContain("'alfaclub/leaderboard'")
    expect(src).toContain("'alfaclub/run'")
    expect(src).toContain("'alfaclub/radar'")
    expect(src).toContain("'alfaclub/compare'")
    expect(src).toContain("'alfaclub/relay-now'")
    expect(src).toContain("'alfaclub/chat-token'")
  })
})
