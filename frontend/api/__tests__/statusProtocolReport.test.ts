import { describe, expect, it } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

describe('status protocol report chain selection', () => {
  it('returns Base chainId (8453)', async () => {
    const mod = await import('../_handlers/status/_protocolReport.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.chainId).toBe(8453)
  })

  it('rejects non-GET methods', async () => {
    const mod = await import('../_handlers/status/_protocolReport.ts')
    const handler = mod.default

    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body?.success).toBe(false)
  })
})
