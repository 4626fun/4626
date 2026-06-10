import { afterEach, describe, expect, it } from 'vitest'

import handler from '../_handlers/vaults/_activeProtected.ts'
import { createMockReq, createMockRes } from './helpers'

const ORIGINAL_KPR_API_KEY = process.env.KPR_API_KEY

describe('kpr/vaults/active', () => {
  afterEach(() => {
    if (ORIGINAL_KPR_API_KEY === undefined) {
      delete process.env.KPR_API_KEY
    } else {
      process.env.KPR_API_KEY = ORIGINAL_KPR_API_KEY
    }
  })

  it('rejects non-GET methods', async () => {
    process.env.KPR_API_KEY = 'test-key'
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body?.success).toBe(false)
  })

  it('requires bearer auth', async () => {
    process.env.KPR_API_KEY = 'test-key'
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
  })
})
