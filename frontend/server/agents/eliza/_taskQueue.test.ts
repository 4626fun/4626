import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../../_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

describe('agent background queue reliability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(null)
  })

  it('returns queue stats with stale processing count', async () => {
    const db = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('CREATE TABLE')) return { rows: [] }
        if (sql.includes('CREATE INDEX')) return { rows: [] }
        return {
          rows: [
            { status: 'pending', count: '2' },
            { status: 'processing', count: '1' },
            { status: 'done', count: '5' },
            { status: 'failed', count: '1' },
            { status: 'stale_processing', count: '1' },
          ],
        }
      }),
      sql: vi.fn(async () => ({ rows: [] })),
    }
    getDbMock.mockResolvedValue(db)

    const { getAgentBackgroundQueueStats } = await import('./_taskQueue.ts')
    const stats = await getAgentBackgroundQueueStats({
      staleLeaseMs: 60_000,
    })

    expect(stats).toEqual({
      pending: 2,
      processing: 1,
      done: 5,
      failed: 1,
      staleProcessing: 1,
    })
  })
})

