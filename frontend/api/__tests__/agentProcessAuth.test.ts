import { afterEach, describe, expect, it } from 'vitest'

import { applyEnv, createMockReq } from './helpers'

describe('agent/process auth hardening', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('accepts Authorization bearer cron secret', async () => {
    restoreEnv = applyEnv({ CRON_SECRET: 'cron-test-secret' })
    const mod = await import('../_handlers/agent/_process.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer cron-test-secret' },
    })
    expect(mod.isAuthorized(req)).toBe(true)
  })

  it('accepts x-cron-secret header', async () => {
    restoreEnv = applyEnv({ CRON_SECRET: 'cron-test-secret' })
    const mod = await import('../_handlers/agent/_process.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-cron-secret': 'cron-test-secret' },
    })
    expect(mod.isAuthorized(req)).toBe(true)
  })

  it('rejects query-string secrets', async () => {
    restoreEnv = applyEnv({ CRON_SECRET: 'cron-test-secret' })
    const mod = await import('../_handlers/agent/_process.ts')
    const req = createMockReq({
      method: 'POST',
      query: { secret: 'cron-test-secret' },
    })
    expect(mod.isAuthorized(req)).toBe(false)
  })
})
