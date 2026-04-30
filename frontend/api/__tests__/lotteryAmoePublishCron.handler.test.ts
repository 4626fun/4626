// PR 5b — `_amoePublishCron` handler integration tests.
//
// Covers the Vercel-cron publisher handler
// (GET /api/v1/lottery/amoe/publish-cron):
//
//   1. Routing — `lottery/amoe/publish-cron` resolves to a function.
//   2. Method enforcement — non-GET/POST → 405.
//   3. AMOE_ZK_SUBMIT_ENABLED missing → 503 `zk_path_disabled`.
//   4. AMOE_LEDGER_PUBLISHER_ENABLED missing → 503 `publisher_disabled`.
//   5. Cron auth — missing / wrong / too-short bearer → 401 unauthorized.
//   6. LOTTERY_AMOE_ROUTER unset → 503.
//   7. Pre-genesis epoch (currentEpoch == 0) → 200 `tick: 'pre_genesis'`.
//   8. Happy path — `publishEpoch` invoked with the correct args, outcome
//      surfaces in response body.
//   9. `no_publisher_key_configured` thrown by publisher → 200 with
//      `tick: 'no_publisher_key_configured'` (NOT 503).
//  10. Other errors caught and reported as `tick: 'errored'` with message.
//  11. `reclaimStrandedPublisherRuns` failures do NOT blow up the tick.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

// ---------------------------------------------------------------------------
// Hoisted mocks for the publisher module
// ---------------------------------------------------------------------------

const {
  publishEpochMock,
  reclaimStrandedPublisherRunsMock,
  pickNextEpochToPublishMock,
  isAmoeLedgerPublisherEnabledMock,
  readPublisherClaimedByMock,
  defaultBroadcastMock,
  defaultConfirmMock,
  defaultLookupBurnContextMock,
  requirePublisherDbMock,
} = vi.hoisted(() => ({
  publishEpochMock: vi.fn(),
  reclaimStrandedPublisherRunsMock: vi.fn(),
  pickNextEpochToPublishMock: vi.fn(),
  isAmoeLedgerPublisherEnabledMock: vi.fn(),
  readPublisherClaimedByMock: vi.fn(),
  defaultBroadcastMock: vi.fn(),
  defaultConfirmMock: vi.fn(),
  defaultLookupBurnContextMock: vi.fn(),
  requirePublisherDbMock: vi.fn(),
}))

vi.mock('../../server/_lib/lottery/amoeLedgerPublisher.js', () => ({
  publishEpoch: publishEpochMock,
  reclaimStrandedPublisherRuns: reclaimStrandedPublisherRunsMock,
  pickNextEpochToPublish: pickNextEpochToPublishMock,
  isAmoeLedgerPublisherEnabled: isAmoeLedgerPublisherEnabledMock,
  readPublisherClaimedBy: readPublisherClaimedByMock,
  defaultBroadcastSetPointsLedgerRoot: defaultBroadcastMock,
  defaultConfirmTransactionReceipt: defaultConfirmMock,
  defaultLookupBurnContext: defaultLookupBurnContextMock,
  requirePublisherDb: requirePublisherDbMock,
}))

import {
  __resetAmoePublishCronHandlerHooksForTest,
  __setAmoePublishCronHandlerHooksForTest,
} from '../_handlers/v1/lottery/_amoePublishCron.js'
import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'
const LOTTERY_ROUTER = '0x000000000000000000000000000000000000abcd'

// AMOE epoch constants are compile-time (see amoeWitness.ts):
//   genesis = 1_777_507_200 (Apr 28, 2026 UTC)
//   length  = 86_400 seconds (1 day)
// We pick a nowSec that puts currentEpoch == 6 (so targetEpoch == 5).
const AMOE_EPOCH_GENESIS = 1_777_507_200n
const AMOE_EPOCH_LENGTH = 86_400n
const NOW_FOR_EPOCH_5_TARGET =
  AMOE_EPOCH_GENESIS + 6n * AMOE_EPOCH_LENGTH + 1n
const NOW_BEFORE_GENESIS = AMOE_EPOCH_GENESIS - 1n

function setEnabledEnv(): () => void {
  return applyEnv({
    AMOE_ZK_SUBMIT_ENABLED: '1',
    LOTTERY_AMOE_ROUTER: LOTTERY_ROUTER,
    CRON_SECRET: VALID_SECRET,
    AMOE_CRON_SECRET: undefined,
  })
}

function fakeDb(): any {
  return { sql: vi.fn(async () => ({ rows: [] })) }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('lottery/amoe/publish-cron handler', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    restoreEnv = setEnabledEnv()
    publishEpochMock.mockReset()
    reclaimStrandedPublisherRunsMock.mockReset()
    pickNextEpochToPublishMock.mockReset()
    isAmoeLedgerPublisherEnabledMock.mockReset()
    readPublisherClaimedByMock.mockReset()
    defaultBroadcastMock.mockReset()
    defaultConfirmMock.mockReset()
    defaultLookupBurnContextMock.mockReset()
    requirePublisherDbMock.mockReset()

    // Defaults: enabled, valid db, sane reclaim count.
    isAmoeLedgerPublisherEnabledMock.mockReturnValue(true)
    readPublisherClaimedByMock.mockReturnValue('test-pod-1')
    requirePublisherDbMock.mockResolvedValue(fakeDb())
    reclaimStrandedPublisherRunsMock.mockResolvedValue(0)
    // By default, target the latest closed epoch (= currentEpoch - 1)
    // for the configured nowSec. Tests that exercise backfill or
    // "nothing to publish" override this.
    pickNextEpochToPublishMock.mockImplementation(
      async (_db: unknown, args: { latestClosedEpoch: bigint }) =>
        args.latestClosedEpoch,
    )
  })

  afterEach(() => {
    __resetAmoePublishCronHandlerHooksForTest()
    restoreEnv()
  })

  it('routes lottery/amoe/publish-cron to a handler', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    expect(typeof handler).toBe('function')
  })

  it('returns 405 for non-GET/POST methods', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({ method: 'DELETE' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(405)
    expect(res.body).toMatchObject({ ok: false })
  })

  it('returns 503 zk_path_disabled when AMOE_ZK_SUBMIT_ENABLED unset', async () => {
    const cleanup = applyEnv({ AMOE_ZK_SUBMIT_ENABLED: undefined })
    try {
      const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({ ok: false, error: 'zk_path_disabled' })
    } finally {
      cleanup()
    }
  })

  it('returns 503 publisher_disabled when AMOE_LEDGER_PUBLISHER_ENABLED unset', async () => {
    isAmoeLedgerPublisherEnabledMock.mockReturnValue(false)
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body).toMatchObject({ ok: false, error: 'publisher_disabled' })
  })

  it('returns 401 when bearer is missing', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' })
  })

  it('returns 401 when bearer is wrong', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret-of-sufficient-length-32' },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('returns 503 when LOTTERY_AMOE_ROUTER is unset', async () => {
    const cleanup = applyEnv({ LOTTERY_AMOE_ROUTER: undefined })
    try {
      const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
      const req = createMockReq({
        method: 'GET',
        headers: { authorization: `Bearer ${VALID_SECRET}` },
      })
      const res = createMockRes()
      await handler!(req, res)
      expect(res.statusCode).toBe(503)
      expect(res.body).toMatchObject({
        ok: false,
        error: 'lottery_amoe_router_not_configured',
      })
    } finally {
      cleanup()
    }
  })

  it('returns pre_genesis tick when currentEpoch == 0', async () => {
    // Use the test hook's nowSec to pin the epoch to 0.
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_BEFORE_GENESIS,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ ok: true, tick: 'pre_genesis' })
    expect(publishEpochMock).not.toHaveBeenCalled()
  })

  it('happy path: publishEpoch invoked, outcome surfaces in response', async () => {
    publishEpochMock.mockResolvedValue({
      kind: 'finished',
      epoch: 5n,
      rootHex: '0x1111111111111111111111111111111111111111111111111111111111111111',
      txHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      // pin nowSec so currentEpoch is deterministic; genesis 1700000000,
      // duration 3600 → currentEpoch = floor((nowSec - genesis) / 3600).
      nowSec: NOW_FOR_EPOCH_5_TARGET,
      publisherVersion: 'test-sha-deadbeef',
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'finished',
      epoch: '5',
      reclaimedCount: 0,
      outcome: {
        kind: 'finished',
        rootHex:
          '0x1111111111111111111111111111111111111111111111111111111111111111',
        txHash:
          '0x2222222222222222222222222222222222222222222222222222222222222222',
      },
    })
    expect(publishEpochMock).toHaveBeenCalledTimes(1)
    const callArgs = publishEpochMock.mock.calls[0]![0]
    expect(callArgs.epoch).toBe(5n)
    expect(callArgs.lotteryAmoeRouter).toBe(LOTTERY_ROUTER)
    expect(callArgs.publisherVersion).toBe('test-sha-deadbeef')
    expect(callArgs.claimedBy).toBe('test-pod-1')
  })

  it('surfaces finished_no_op outcome with reason', async () => {
    publishEpochMock.mockResolvedValue({
      kind: 'finished_no_op',
      epoch: 5n,
      reason: 'empty_epoch',
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'finished_no_op',
      outcome: { kind: 'finished_no_op', reason: 'empty_epoch' },
    })
  })

  it('surfaces in_flight outcome with phase', async () => {
    publishEpochMock.mockResolvedValue({
      kind: 'in_flight',
      epoch: 5n,
      phase: 'confirming',
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'in_flight',
      outcome: { kind: 'in_flight', phase: 'confirming' },
    })
  })

  it('returns 200 no_publisher_key_configured when publisher throws no-key error', async () => {
    publishEpochMock.mockRejectedValue(new Error('no_publisher_key_configured'))
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'no_publisher_key_configured',
      epoch: '5',
    })
  })

  it('catches publishEpoch errors as tick:errored with truncated message', async () => {
    const longMessage = 'boom_'.repeat(200) // 1000 chars
    publishEpochMock.mockRejectedValue(new Error(longMessage))
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.tick).toBe('errored')
    expect(res.body.error.length).toBeLessThanOrEqual(500)
    expect(res.body.error.startsWith('boom_')).toBe(true)
  })

  it('reclaim failures do not blow up the tick', async () => {
    reclaimStrandedPublisherRunsMock.mockRejectedValue(new Error('db_down'))
    publishEpochMock.mockResolvedValue({
      kind: 'finished',
      epoch: 5n,
      rootHex: '0x' + '11'.repeat(32),
      txHash: '0x' + '22'.repeat(32),
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'finished',
      reclaimedCount: 0, // swallowed → 0
    })
  })

  it('passes reclaim count from publisher to response', async () => {
    reclaimStrandedPublisherRunsMock.mockResolvedValue(3)
    publishEpochMock.mockResolvedValue({
      kind: 'lost_claim',
      epoch: 5n,
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'lost_claim',
      reclaimedCount: 3,
    })
  })

  // -------------------------------------------------------------------
  // Backfill: cron must retry older missed epochs
  // -------------------------------------------------------------------

  it('backfill: targets the older epoch returned by pickNextEpochToPublish', async () => {
    // Simulate: currentEpoch=6, latestClosedEpoch=5, but epoch 5 already
    // confirmed and epoch 3 was missed (cron disabled). pickNext returns 3.
    pickNextEpochToPublishMock.mockResolvedValue(3n)
    publishEpochMock.mockResolvedValue({
      kind: 'finished',
      epoch: 3n,
      rootHex: '0xabc',
      txHash: '0xdef',
    })
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'finished',
      epoch: '3',
    })
    // The publisher was called for epoch 3, not epoch 5.
    const callArgs = publishEpochMock.mock.calls[0]![0]
    expect(callArgs.epoch).toBe(3n)
    // pickNext was called with latestClosedEpoch == currentEpoch - 1.
    const pickArgs = pickNextEpochToPublishMock.mock.calls[0]!
    expect(pickArgs[1].latestClosedEpoch).toBe(5n)
  })

  it('returns nothing_to_publish when every epoch in horizon is handled', async () => {
    pickNextEpochToPublishMock.mockResolvedValue(null)
    __setAmoePublishCronHandlerHooksForTest({
      db: fakeDb(),
      nowSec: NOW_FOR_EPOCH_5_TARGET,
    })
    const handler = await getV1ApiHandler('lottery/amoe/publish-cron')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      tick: 'nothing_to_publish',
      latestClosedEpoch: '5',
    })
    // Crucially, publishEpoch is NOT called when there's nothing to do.
    expect(publishEpochMock).not.toHaveBeenCalled()
  })
})
