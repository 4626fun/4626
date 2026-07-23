import { describe, expect, it } from 'vitest'

import vercelConfig from '../../vercel.json'

describe('raw-body webhook routing', () => {
  it('routes signature-sensitive webhooks before the API catch-all', () => {
    const routes = vercelConfig.routes as Array<{ src?: string; dest?: string }>
    const catchAll = routes.findIndex((route) => route.src === '/api/(.*)')
    expect(catchAll).toBeGreaterThan(0)
    for (const path of [
      '/api/x/account-activity/webhook',
      '/api/creator/strategy/stripe/webhook',
    ]) {
      const index = routes.findIndex((route) => route.src === path && route.dest === path)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(catchAll)
    }
  })
})
