// Zora CSW scan cron handler integration tests.
//
// Mirrors the style of lotteryAmoePublishCron.handler.test.ts:
// hoist mocks for the module-under-test's collaborators, then drive
// the handler via getV1ApiHandler so route resolution is exercised
// end-to-end.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

import {
  __resetZoraCswScanCronHandlerHooksForTest,
  __setZoraCswScanCronHandlerHooksForTest,
} from '../_handlers/v1/zora-csw/_scanCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'
import type { CswCreation } from '../../server/_lib/zora-csw/scanCreations.js'

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

/**
 * Build a minimal Supabase-shaped mock that captures the chained
 * select / upsert calls and serves canned responses. The handler only
 * uses the surface in `_scanCron.ts`:
 *   db.from('zora_csw_indexer_state').select('value').eq(..).maybeSingle()
 *   db.from('zora_csw_owners').select('creation_block').order(..).limit(..)
 *   db.from('zora_csw_owners').upsert(rows, { onConflict, ignoreDuplicates })
 *   db.from('zora_csw_indexer_state').upsert(row, { onConflict })
 */
type CapturedCall = {
  table: string
  op: 'select' | 'upsert'
  args: unknown
}

function makeFakeDb(opts: {
  stateRow?: { block: string | number } | null
  maxOwnerBlock?: number | null
  upsertOwnersError?: string
  upsertStateError?: string
  readStateError?: string
}) {
  const captured: CapturedCall[] = []

  function makeSelectChain(table: string, response: { data: unknown; error: { message: string } | null }) {
    const chain: any = {}
    const pass = () => chain
    chain.select = pass
    chain.eq = pass
    chain.is = pass
    chain.not = pass
    chain.lt = pass
    chain.gt = pass
    chain.order = pass
    chain.limit = pass
    chain.maybeSingle = async () => {
      captured.push({ table, op: 'select', args: { method: 'maybeSingle' } })
      return response
    }
    chain.then = (resolve: any) => {
      captured.push({ table, op: 'select', args: { method: 'await' } })
      resolve(response)
    }
    return chain
  }

  return {
    captured,
    from(table: string) {
      if (table === 'zora_csw_indexer_state') {
        return {
          select: (_cols: string) => {
            if (opts.readStateError) {
              return makeSelectChain(table, { data: null, error: { message: opts.readStateError } })
            }
            const data = opts.stateRow ? { value: opts.stateRow } : null
            return makeSelectChain(table, { data, error: null })
          },
          upsert: async (row: unknown, options: unknown) => {
            captured.push({ table, op: 'upsert', args: { row, options } })
            if (opts.upsertStateError) return { error: { message: opts.upsertStateError } }
            return { error: null }
          },
        }
      }
      if (table === 'zora_csw_owners') {
        return {
          select: (_cols: string) => {
            const data =
              opts.maxOwnerBlock !== null && opts.maxOwnerBlock !== undefined
                ? [{ creation_block: opts.maxOwnerBlock }]
                : []
            return makeSelectChain(table, { data, error: null })
          },
          upsert: async (rows: unknown, options: unknown) => {
            captured.push({ table, op: 'upsert', args: { rows, options } })
            if (opts.upsertOwnersError) return { error: { message: opts.upsertOwnersError } }
            return { error: null }
          },
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  } as any
}

describe('zora-csw/scan-cron handler', () => {
  let restoreEnv: () => void
  beforeEach(() => {
    restoreEnv = setEnabledEnv()
  })
  afterEach(() => {
    __resetZoraCswScanCronHandlerHooksForTest()
    restoreEnv()
  })

  it('routes zora-csw/scan-cron to a handler', async () => {
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    expect(typeof handler).toBe('function')
  })

  it('returns 503 when feature flag is missing', async () => {
    const cleanup = applyEnv({ ZORA_CSW_INDEXER_ENABLED: undefined })
    try {
      const handler = await getV1ApiHandler('zora-csw/scan-cron')
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
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' })
  })

  it('returns 401 when bearer is wrong', async () => {
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret-of-sufficient-length-32' },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('bootstraps idle when no state row and no owners', async () => {
    const db = makeFakeDb({ stateRow: null, maxOwnerBlock: null })
    __setZoraCswScanCronHandlerHooksForTest({
      db,
      getTipBlock: async () => 100n,
      fetchWindow: async () => [],
    })
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tick: 'idle', new_csws: 0 })
    expect(res.body.note).toMatch(/seed last_scanned_block/)
  })

  it('returns skipped when chain has not advanced past safety horizon', async () => {
    const db = makeFakeDb({ stateRow: { block: 1000 } })
    __setZoraCswScanCronHandlerHooksForTest({
      db,
      getTipBlock: async () => 1005n, // below 1000 + 12 confirmations
      fetchWindow: async () => [],
    })
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tick: 'skipped', new_csws: 0 })
  })

  it('scans, inserts, and bumps state on a normal tick', async () => {
    const db = makeFakeDb({ stateRow: { block: 1000 } })
    const creations: CswCreation[] = [
      {
        cswAddress: '0x1111111111111111111111111111111111111111',
        baseOwner: '0x2222222222222222222222222222222222222222',
        initialOwners: ['0x2222222222222222222222222222222222222222'],
        nonce: 0n,
        blockNumber: 1500n,
        txHash: ('0x' + 'aa'.repeat(32)) as `0x${string}`,
        logIndex: 1,
      },
      {
        cswAddress: '0x3333333333333333333333333333333333333333',
        baseOwner: '0x4444444444444444444444444444444444444444',
        initialOwners: ['0x4444444444444444444444444444444444444444'],
        nonce: 1n,
        blockNumber: 1600n,
        txHash: ('0x' + 'bb'.repeat(32)) as `0x${string}`,
        logIndex: 2,
      },
    ]
    const fetchSpy = vi.fn(async () => creations)
    __setZoraCswScanCronHandlerHooksForTest({
      db,
      getTipBlock: async () => 5_000n,
      fetchWindow: fetchSpy,
    })
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'scanned',
      from_block: '1001',
      to_block: '4988', // 5000 - 12 confirmations
      new_csws: 2,
    })
    expect(fetchSpy).toHaveBeenCalledWith(1001n, 4988n)

    const ownersUpsert = db.captured.find(
      (c: CapturedCall) => c.table === 'zora_csw_owners' && c.op === 'upsert',
    )
    expect(ownersUpsert).toBeDefined()
    expect((ownersUpsert!.args as any).options).toMatchObject({
      onConflict: 'csw_address',
      ignoreDuplicates: true,
    })
    expect(((ownersUpsert!.args as any).rows as unknown[]).length).toBe(2)

    const stateUpsert = db.captured.find(
      (c: CapturedCall) => c.table === 'zora_csw_indexer_state' && c.op === 'upsert',
    )
    expect(stateUpsert).toBeDefined()
    expect((stateUpsert!.args as any).row.value.block).toBe('4988')
  })

  it('caps the window at INDEXER_GETLOGS_WINDOW', async () => {
    const cleanup = applyEnv({ INDEXER_GETLOGS_WINDOW: '500' })
    try {
      const db = makeFakeDb({ stateRow: { block: 1000 } })
      const fetchSpy = vi.fn(async () => [])
      __setZoraCswScanCronHandlerHooksForTest({
        db,
        getTipBlock: async () => 100_000n,
        fetchWindow: fetchSpy,
      })
      const handler = await getV1ApiHandler('zora-csw/scan-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.body).toMatchObject({
        tick: 'scanned',
        from_block: '1001',
        to_block: '1500', // 1001 + 500 - 1
      })
      expect(fetchSpy).toHaveBeenCalledWith(1001n, 1500n)
    } finally {
      cleanup()
    }
  })

  it('returns 200 with errored tick when getLogs throws', async () => {
    const db = makeFakeDb({ stateRow: { block: 1000 } })
    __setZoraCswScanCronHandlerHooksForTest({
      db,
      getTipBlock: async () => 5_000n,
      fetchWindow: async () => {
        throw new Error('rpc_quota_exceeded')
      },
    })
    const handler = await getV1ApiHandler('zora-csw/scan-cron')
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
      new_csws: 0,
    })
    expect(String(res.body.error)).toContain('rpc_quota_exceeded')
  })
})
