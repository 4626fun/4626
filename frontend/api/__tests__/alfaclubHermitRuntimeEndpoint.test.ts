import { describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const { readHermitRuntimeStatusSnapshotMock } = vi.hoisted(() => ({
  readHermitRuntimeStatusSnapshotMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/hermitRuntimeStatus.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/alfaclub/hermitRuntimeStatus.ts')
  >('../../server/_lib/alfaclub/hermitRuntimeStatus.ts')
  return {
    ...actual,
    readHermitRuntimeStatusSnapshot: readHermitRuntimeStatusSnapshotMock,
  }
})

import handler from '../_handlers/v1/alfaclub/_hermit-runtime.ts'

describe('GET /api/v1/alfaclub/hermit-runtime', () => {
  it('returns snapshot payload on success', async () => {
    readHermitRuntimeStatusSnapshotMock.mockResolvedValueOnce({
      generatedAt: '2026-07-15T19:00:00.000Z',
      reactionRooms: {
        configured: ['1659'],
        runtime: ['1659', '1484'],
      },
      bridgeAuth: null,
      events: {
        last24h: { total: 0, executed: 0, failed: 0, blocked: 0, rejected: 0, pending: 0 },
        recent: [],
      },
    })

    const req = createMockReq({ method: 'GET', query: { limit: '20' } })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(readHermitRuntimeStatusSnapshotMock).toHaveBeenCalledWith(20)
  })

  it('rejects non-GET requests', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})
