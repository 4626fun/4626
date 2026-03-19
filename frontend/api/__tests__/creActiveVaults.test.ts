import { afterEach, describe, expect, it } from 'vitest'

import handler from '../_handlers/cre/vaults/_active.ts'
import { createMockReq, createMockRes } from './helpers'

const ORIGINAL_KEEPR_API_KEY = process.env.KEEPR_API_KEY

describe('cre/vaults/active', () => {
  afterEach(() => {
    if (ORIGINAL_KEEPR_API_KEY === undefined) {
      delete process.env.KEEPR_API_KEY
    } else {
      process.env.KEEPR_API_KEY = ORIGINAL_KEEPR_API_KEY
    }
  })

  it('rejects non-GET methods', async () => {
    process.env.KEEPR_API_KEY = 'test-key'
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body?.success).toBe(false)
  })

  it('requires bearer auth', async () => {
    process.env.KEEPR_API_KEY = 'test-key'
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })
})
