import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('alfaclub trading-rooms wiring', () => {
  it('registers the v1 route map entry', () => {
    const src = readFileSync(new URL('../_handlers/_routes.v1.ts', import.meta.url), 'utf8')
    expect(src).toContain("'alfaclub/trading-rooms'")
    expect(src).toContain("'alfaclub/key-safety-summary'")
    const rootRoutes = readFileSync(new URL('../_handlers/_routes.ts', import.meta.url), 'utf8')
    expect(rootRoutes).toContain("'wallet/friend-key-holdings'")
  })

  it('registers the vite API import for local dev', () => {
    const src = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8')
    expect(src).toContain("'/api/v1/alfaclub/trading-rooms'")
    expect(src).toContain("'/api/wallet/friend-key-holdings'")
  })

  it('hosts trading-rooms on the dedicated AlfaClub shell, not app/marketing tables', () => {
    const routes = readFileSync(new URL('../../src/app/routeDefinitions.tsx', import.meta.url), 'utf8')
    const hostRoutes = readFileSync(new URL('../../src/app/alfaclubHostRoutes.tsx', import.meta.url), 'utf8')
    expect(routes).not.toContain("path: '/alfaclub/trading-rooms'")
    expect(hostRoutes).toContain('ALFACLUB_ROOMS_PATH')
    expect(hostRoutes).toContain('AlfaClubTradingRooms')
  })
})
