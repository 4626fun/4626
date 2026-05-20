import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

import {
  __resetZoraProfilesRefreshCronHooksForTest,
  __setZoraProfilesRefreshCronHooksForTest,
} from '../_handlers/v1/zora-profiles/_refreshCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'

function setEnabledEnv(): () => void {
  return applyEnv({
    ZORA_PROFILES_REFRESH_ENABLED: '1',
    CRON_SECRET: VALID_SECRET,
    AMOE_CRON_SECRET: undefined,
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-fake',
    ZORA_SERVER_API_KEY: 'zora-test-key',
  })
}

describe('zora-profiles/refresh-cron handler', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    restoreEnv = setEnabledEnv()
  })

  afterEach(() => {
    __resetZoraProfilesRefreshCronHooksForTest()
    restoreEnv()
  })

  it('routes zora-profiles/refresh-cron to a handler', async () => {
    const handler = await getV1ApiHandler('zora-profiles/refresh-cron')
    expect(typeof handler).toBe('function')
  })

  it('returns skipped when feature flag is off', async () => {
    const cleanup = applyEnv({
      ZORA_PROFILES_REFRESH_ENABLED: undefined,
      CRON_SECRET: VALID_SECRET,
    })
    try {
      const handler = await getV1ApiHandler('zora-profiles/refresh-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.statusCode).toBe(200)
      expect(res.body).toMatchObject({
        ok: true,
        tick: 'skipped',
        reason: 'feature_disabled',
      })
    } finally {
      cleanup()
    }
  })

  it('returns 401 without cron auth', async () => {
    const handler = await getV1ApiHandler('zora-profiles/refresh-cron')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('runs refresh tick when authorized', async () => {
    const runTick = vi.fn(async () => ({
      ok: true as const,
      tick: 'refreshed' as const,
      scan: {
        coinsFetched: 50,
        profilesUpserted: 48,
        skippedNoHandle: 2,
        pages: 1,
        listType: 'most_valuable_creators',
      },
      wallets: { selected: 10, updated: 9, withSmartWallet: 5, failed: 1 },
      cswIndexRowsUpdated: 3,
    }))
    __setZoraProfilesRefreshCronHooksForTest({ runTick })

    const handler = await getV1ApiHandler('zora-profiles/refresh-cron')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(runTick).toHaveBeenCalledOnce()
    expect(res.body?.tick).toBe('refreshed')
    expect(res.body?.scan?.profilesUpserted).toBe(48)
  })

  it('returns errored tick envelope without throwing', async () => {
    const runTick = vi.fn(async () => ({
      ok: false as const,
      tick: 'errored' as const,
      error: 'zora_explore_fetch_failed:timeout',
    }))
    __setZoraProfilesRefreshCronHooksForTest({ runTick })

    const handler = await getV1ApiHandler('zora-profiles/refresh-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.ok).toBe(false)
    expect(res.body?.error).toContain('timeout')
  })
})
