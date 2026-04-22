import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  getLatestSnapshotTsMock,
  getSnapshotAtMock,
  listRecentPublicationsMock,
  readVigilanteFlagsMock,
} = vi.hoisted(() => ({
  getLatestSnapshotTsMock: vi.fn(),
  getSnapshotAtMock: vi.fn(),
  listRecentPublicationsMock: vi.fn(),
  readVigilanteFlagsMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/publicationLedger.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/publicationLedger.ts')
  >('../../server/_lib/alfaclub/publicationLedger.ts')
  return {
    ...actual,
    getLatestSnapshotTs: getLatestSnapshotTsMock,
    getSnapshotAt: getSnapshotAtMock,
    listRecentPublications: listRecentPublicationsMock,
  }
})

vi.mock('../../server/_lib/alfaclub/vigilante.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/vigilante.ts')
  >('../../server/_lib/alfaclub/vigilante.ts')
  return {
    ...actual,
    readVigilanteFlags: readVigilanteFlagsMock,
  }
})

import leaderboardHandler from '../_handlers/v1/alfaclub/_leaderboard.ts'

const BASE_FLAGS = {
  killSwitch: false,
  readEnabled: true,
  postEnabled: false,
  feedbackEnabled: false,
  topN: 5,
  cooldownHours: 24,
}

describe('GET /api/v1/alfaclub/leaderboard', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({})
    readVigilanteFlagsMock.mockReturnValue(BASE_FLAGS)
    listRecentPublicationsMock.mockResolvedValue([])
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects non-GET methods with 405', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await leaderboardHandler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 503 when the kill switch is on', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, killSwitch: true })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await leaderboardHandler(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('alfaclub_vigilante_kill_switch')
  })

  it('returns empty shell with reason=read_disabled when read is off', async () => {
    readVigilanteFlagsMock.mockReturnValue({ ...BASE_FLAGS, readEnabled: false })
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await leaderboardHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(false)
    expect(res.body?.reason).toBe('read_disabled')
    expect(res.body?.data?.rows).toEqual([])
  })

  it('returns ok with empty rows when no snapshot has been written yet', async () => {
    getLatestSnapshotTsMock.mockResolvedValue(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await leaderboardHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.reason).toBe('no_snapshot_yet')
  })

  it('returns the latest snapshot rows, capped by topN', async () => {
    getLatestSnapshotTsMock.mockResolvedValue('2026-04-20T12:00:00Z')
    getSnapshotAtMock.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({
        snapshotTs: '2026-04-20T12:00:00Z',
        creatorAddress: `0x${'a'.repeat(39)}${i}`,
        tokenId: BigInt(i + 1),
        totalSupply: 100n,
        stakedSupply: 50n,
        pnl30dUsd: 100 * (i + 1),
        hlAccountValueUsd: 10_000,
        score: 1 - i / 100,
        rank: i + 1,
      })),
    )
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await leaderboardHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.topN).toBe(BASE_FLAGS.topN)
    expect(res.body?.data?.rows).toHaveLength(BASE_FLAGS.topN)
    expect(res.body?.data?.totalRanked).toBe(12)
    expect(res.body?.disclaimer).toContain('4626 Keepr onchain-derived snapshot')
  })
})
