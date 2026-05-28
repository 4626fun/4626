import { beforeEach, describe, expect, it } from 'vitest'
import prepareHandler from '../../../../../api/_handlers/base-mcp/_prepare'
import requestStatusHandler from '../../../../../api/_handlers/base-mcp/_request-status'
import requestUpdateHandler from '../../../../../api/_handlers/base-mcp/_request-update'

function createRes() {
  const res: any = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(key: string, value: string) {
      this.headers[key] = value
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    end() {
      return this
    },
  }
  return res
}

function createPostReq(body: unknown): any {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }
}

describe('base mcp api handlers', () => {
  beforeEach(() => {
    process.env.BASE_MCP_ENABLED = '1'
    process.env.BASE_MCP_ALLOWED_TOKENS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,0x4200000000000000000000000000000000000006'
    process.env.BASE_MCP_CANONICAL_SENDER = '0x1111111111111111111111111111111111111111'
    process.env.BASE_MCP_EOA_SENDER = ''
  })



  it('returns 503 when base mcp is disabled', async () => {
    process.env.BASE_MCP_ENABLED = '0'
    const req = createPostReq({
      action: 'prepareTransfer',
      userId: 'u0',
      chainId: 8453,
      token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      amount: '100',
      recipient: '0x1111111111111111111111111111111111111111',
      clientRequestId: 'r0',
    })
    const res = createRes()
    await prepareHandler(req, res)
    expect(res.statusCode).toBe(503)
  })
  it('returns blocked for disallowed token', async () => {
    const req = createPostReq({
      action: 'prepareTransfer',
      userId: 'u1',
      chainId: 8453,
      token: '0x2222222222222222222222222222222222222222',
      amount: '100',
      recipient: '0x1111111111111111111111111111111111111111',
      clientRequestId: 'r1',
    })
    const res = createRes()

    await prepareHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.status).toBe('blocked')
    expect(res.body?.data?.reasonCode).toBe('policy_token_not_allowed')
  })

  it('creates approval request and can query status', async () => {
    const req = createPostReq({
      action: 'prepareSwap',
      userId: 'u2',
      chainId: 8453,
      sellToken: '0x4200000000000000000000000000000000000006',
      buyToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmount: '100',
      maxSlippageBps: 50,
      quoteTtlSeconds: 60,
      clientRequestId: 'r2',
    })
    const res = createRes()
    await prepareHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.status).toBe('ok')

    const requestId = res.body?.data?.approval?.requestId
    const statusReq: any = { method: 'GET', query: { requestId } }
    const statusRes = createRes()
    await requestStatusHandler(statusReq, statusRes)

    expect(statusRes.statusCode).toBe(200)
    expect(statusRes.body?.success).toBe(true)
    expect(statusRes.body?.data?.status).toBe('pending')
  })


  it('updates request status to approved', async () => {
    const req = createPostReq({
      action: 'prepareSwap',
      userId: 'u3',
      chainId: 8453,
      sellToken: '0x4200000000000000000000000000000000000006',
      buyToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      sellAmount: '250',
      maxSlippageBps: 50,
      quoteTtlSeconds: 60,
      clientRequestId: 'r3',
    })
    const res = createRes()
    await prepareHandler(req, res)

    const requestId = res.body?.data?.approval?.requestId
    const updateReq = createPostReq({ requestId, status: 'approved' })
    const updateRes = createRes()
    await requestUpdateHandler(updateReq, updateRes)

    expect(updateRes.statusCode).toBe(200)
    expect(updateRes.body?.data?.status).toBe('approved')

    const statusReq: any = { method: 'GET', query: { requestId } }
    const statusRes = createRes()
    await requestStatusHandler(statusReq, statusRes)
    expect(statusRes.body?.data?.status).toBe('approved')
  })
})
