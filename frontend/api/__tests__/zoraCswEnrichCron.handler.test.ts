// Zora CSW enrich cron handler integration tests.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'
import {
  __resetZoraCswEnrichCronHandlerHooksForTest,
  __setZoraCswEnrichCronHandlerHooksForTest,
  type EnrichCandidate,
} from '../_handlers/v1/zora-csw/_enrichCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'
import type { Address } from 'viem'

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'

function setEnabledEnv(): () => void {
  return applyEnv({
    ZORA_CSW_INDEXER_ENABLED: '1',
    CRON_SECRET: VALID_SECRET,
    AMOE_CRON_SECRET: undefined,
    BASE_RPC_URL: 'https://example.invalid/rpc',
    SUPABASE_URL: 'https://example.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-fake',
  })
}

function makeFakeDb(opts: { upsertError?: string } = {}) {
  const captured: Array<{ rows: unknown; options: unknown }> = []
  return {
    captured,
    from(table: string) {
      if (table === 'zora_csw_owners') {
        return {
          upsert: async (rows: unknown, options: unknown) => {
            captured.push({ rows, options })
            if (opts.upsertError) return { error: { message: opts.upsertError } }
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  } as any
}

describe('zora-csw/enrich-cron handler', () => {
  let restoreEnv: () => void
  beforeEach(() => {
    restoreEnv = setEnabledEnv()
  })
  afterEach(() => {
    __resetZoraCswEnrichCronHandlerHooksForTest()
    restoreEnv()
  })

  it('routes zora-csw/enrich-cron to a handler', async () => {
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    expect(typeof handler).toBe('function')
  })

  it('returns 503 when feature flag is missing', async () => {
    const cleanup = applyEnv({ ZORA_CSW_INDEXER_ENABLED: undefined })
    try {
      const handler = await getV1ApiHandler('zora-csw/enrich-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({ ok: false, error: 'feature_disabled' })
    } finally {
      cleanup()
    }
  })

  it('returns 401 when bearer is missing', async () => {
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' })
  })

  it('returns idle tick when no unsynced rows', async () => {
    const db = makeFakeDb()
    __setZoraCswEnrichCronHandlerHooksForTest({
      db,
      selectCandidates: async () => [],
      enrichOne: async () => ({
        addressOwners: [],
        passkeyOwnerCount: 0,
        nextOwnerIndex: null,
        removedOwnersCount: null,
      }),
    })
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'idle',
      processed: 0,
      succeeded: 0,
      failed: 0,
    })
  })

  it('processes a budget-bounded batch and upserts current_owners', async () => {
    const db = makeFakeDb()
    const candidates: EnrichCandidate[] = Array.from({ length: 5 }, (_, i) => ({
      csw_address: `0x${String(i + 1).padStart(40, '0')}`,
      creation_block: 100 + i,
    }))
    const enrichSpy = vi.fn(async (csw: Address) => ({
      addressOwners: [`0xeoa${csw.slice(3, 6)}` as Address],
      passkeyOwnerCount: 1,
      nextOwnerIndex: 2n,
      removedOwnersCount: 0n,
    }))
    __setZoraCswEnrichCronHandlerHooksForTest({
      db,
      budget: 10,
      concurrency: 3,
      selectCandidates: async () => candidates,
      enrichOne: enrichSpy,
    })
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'enriched',
      processed: 5,
      succeeded: 5,
      failed: 0,
      updated: 5,
      budget: 10,
      concurrency: 3,
    })
    expect(enrichSpy).toHaveBeenCalledTimes(5)
    expect(db.captured.length).toBe(1)
    const upserted = db.captured[0]!.rows as Array<Record<string, unknown>>
    expect(upserted).toHaveLength(5)
    expect(upserted[0]).toMatchObject({
      csw_address: candidates[0]!.csw_address,
      current_owners: expect.any(Array),
    })
    expect((upserted[0] as any).metadata.passkey_owner_count).toBe(1)
    expect((upserted[0] as any).metadata.next_owner_index).toBe('2')
  })

  it('handles partial failures: succeeded rows upserted, failed rows reported', async () => {
    const db = makeFakeDb()
    const candidates: EnrichCandidate[] = [
      { csw_address: '0xaaaa000000000000000000000000000000000001', creation_block: 1 },
      { csw_address: '0xaaaa000000000000000000000000000000000002', creation_block: 2 },
      { csw_address: '0xaaaa000000000000000000000000000000000003', creation_block: 3 },
    ]
    __setZoraCswEnrichCronHandlerHooksForTest({
      db,
      budget: 10,
      concurrency: 2,
      selectCandidates: async () => candidates,
      enrichOne: async (csw: Address) => {
        if (csw.endsWith('2')) {
          throw new Error('multicall_revert')
        }
        return {
          addressOwners: [`0xeoa0000000000000000000000000000000000000` as Address],
          passkeyOwnerCount: 0,
          nextOwnerIndex: 1n,
          removedOwnersCount: 0n,
        }
      },
    })
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: false,
      tick: 'enriched',
      processed: 3,
      succeeded: 2,
      failed: 1,
      updated: 2,
    })
  })

  it('returns errored tick when selectCandidates throws', async () => {
    const db = makeFakeDb()
    __setZoraCswEnrichCronHandlerHooksForTest({
      db,
      selectCandidates: async () => {
        throw new Error('postgres_timeout')
      },
    })
    const handler = await getV1ApiHandler('zora-csw/enrich-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: false,
      tick: 'errored',
      processed: 0,
      failed: 0,
    })
    expect(String(res.body.error)).toContain('postgres_timeout')
  })
})
