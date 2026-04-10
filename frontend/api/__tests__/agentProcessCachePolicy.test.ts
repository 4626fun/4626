import { describe, expect, it } from 'vitest'

import handler from '../_handlers/agent/_process.ts'
import { createMockReq, createMockRes } from './helpers'

describe('agent/process cache policy', () => {
  it('sets no-store cache header even on method rejection', async () => {
    const req = createMockReq({ method: 'PUT' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(String(res.getHeader('cache-control') ?? '')).toBe('no-store')
  })
})
