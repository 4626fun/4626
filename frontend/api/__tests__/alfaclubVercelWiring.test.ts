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

  it('frontend/vercel.json registers the daily brief cron after radar', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    const entry = (parsed.crons ?? []).find((c) => c.path === '/api/v1/alfaclub/daily-brief')
    expect(entry).toBeDefined()
    expect(entry?.schedule).toBe('10 12 * * *')
  })

  it('frontend/vercel.json registers a minute cron for /api/v1/alfaclub/chat-bridge-run', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    const entry = (parsed.crons ?? []).find((c) => c.path === '/api/v1/alfaclub/chat-bridge-run')
    expect(entry).toBeDefined()
    expect(entry?.schedule).toBe('* * * * *')
  })

  it('frontend/vercel.json registers a sub-hour cron for /api/v1/alfaclub/chat-token-refresh', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      crons?: Array<{ path?: string; schedule?: string }>
    }
    const entry = (parsed.crons ?? []).find(
      (c) => c.path === '/api/v1/alfaclub/chat-token-refresh',
    )
    expect(entry).toBeDefined()
    // Must fire at least twice per hour so a single missed tick still leaves
    // headroom against Privy's 1-hour identity-token TTL.
    expect(entry?.schedule).toBe('13,43 * * * *')
  })

  it('allows MetaMask SDK websocket connections in the app CSP', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      routes?: Array<{ headers?: Record<string, string> }>
    }
    const csp = (parsed.routes ?? [])
      .map((route) => route.headers?.['content-security-policy'] ?? '')
      .find((value) => value.includes('connect-src'))

    expect(csp).toContain('connect-src')
    expect(csp).toContain('wss://metamask-sdk.api.cx.metamask.io')
    expect(csp).toContain('https://metamask-sdk.api.cx.metamask.io')
  })

  it('allows Pinata gateway images in the app CSP', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      routes?: Array<{ headers?: Record<string, string> }>
    }
    const csp = (parsed.routes ?? [])
      .map((route) => route.headers?.['content-security-policy'] ?? '')
      .find((value) => value.includes('img-src'))

    expect(csp).toContain('img-src')
    expect(csp).toContain('https://*.mypinata.cloud')
    expect(csp).toContain('https://4626.fun')
    expect(csp).toContain('https://pinata.4626.fun')
  })

  it('rewrites branded IPFS paths on 4626.fun through the Pinata gateway', async () => {
    const body = await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')
    const parsed = JSON.parse(body) as {
      routes?: Array<{
        src?: string
        status?: number
        dest?: string
        has?: Array<{ type?: string; value?: string }>
      }>
    }
    const route = (parsed.routes ?? []).find((entry) => entry.src === '/ipfs/(.*)')

    expect(route?.status).toBeUndefined()
    expect(route?.dest).toBe('https://pinata.4626.fun/ipfs/$1')
    expect(route?.has).toEqual([
      {
        type: 'host',
        value: '4626.fun',
      },
    ])
  })

  it('v1 route map exposes alfaclub/leaderboard, run, radar, daily-brief, compare, relay-now, chat-token, chat-token-refresh, chat-bridge-run', async () => {
    const src = await readFile(
      new URL('../_handlers/_routes.v1.ts', import.meta.url),
      'utf8',
    )
    expect(src).toContain("'alfaclub/leaderboard'")
    expect(src).toContain("'alfaclub/run'")
    expect(src).toContain("'alfaclub/radar'")
    expect(src).toContain("'alfaclub/daily-brief'")
    expect(src).toContain("'alfaclub/compare'")
    expect(src).toContain("'alfaclub/relay-now'")
    expect(src).toContain("'alfaclub/chat-token'")
    expect(src).toContain("'alfaclub/chat-token-refresh'")
    expect(src).toContain("'alfaclub/chat-bridge-run'")
  })
})
