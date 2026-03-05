import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/waitlist/_join.ts'
import { createMockReq, createMockRes } from './helpers'

const { getDbMock, ensureWaitlistSchemaMock, sqlMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureWaitlistSchemaMock: vi.fn(),
  sqlMock: vi.fn(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

describe('POST /api/waitlist/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlMock.mockResolvedValue({ rows: [{ id: 42 }] })
    getDbMock.mockResolvedValue({ sql: sqlMock })
  })

  it('creates or updates waitlist entry by email', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'user@example.com' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(ensureWaitlistSchemaMock).toHaveBeenCalled()
    expect(sqlMock).toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toEqual({ ok: true, waitlistEntryId: 42 })
  })

  it('returns 400 for invalid email', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'not-an-email' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
  })
})

