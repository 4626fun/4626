import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from '../helpers'

const { createPublicClientMock } = vi.hoisted(() => ({
  createPublicClientMock: vi.fn(),
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({})),
  }
})

async function loadHandler() {
  const mod = await import('../../_handlers/uniswap/_zquote.ts')
  return mod.default
}

describe('/api/uniswap/zquote', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
    vi.unstubAllGlobals()
  })

  it('returns 400 when required fields are missing', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { tokenIn: '0x0000000000000000000000000000000000000001' },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Missing required field')
  })

  it('returns available=false when configured zQuoter is not deployed', async () => {
    restoreEnv = applyEnv({
      ZQUOTER_BASE_ADDRESS: '0xbe105E9E7f7F392318BFf1f7651E024d96008e86',
    })
    createPublicClientMock.mockReturnValue({
      getBytecode: vi.fn(async () => null),
      readContract: vi.fn(),
    } as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        tokenIn: '0x4200000000000000000000000000000000000006',
        tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountInUnits: '1',
      },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.available).toBe(false)
    expect(String(res.body?.data?.reason ?? '')).toContain('not deployed')
  })

  it('returns normalized quote payload when zQuoter is available', async () => {
    restoreEnv = applyEnv({
      ZQUOTER_BASE_ADDRESS: '0x69c644eBE4A792f601eDddF593c32DDEc35eC5D7',
    })
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(18) // tokenIn decimals
      .mockResolvedValueOnce(6) // tokenOut decimals
      .mockResolvedValueOnce([
        {
          source: 3,
          feeBps: 30n,
          amountIn: 1000000000000000000n,
          amountOut: 3210000n,
        },
        [
          {
            source: 3,
            feeBps: 30n,
            amountIn: 1000000000000000000n,
            amountOut: 3210000n,
          },
        ],
      ]) // getQuotes
    createPublicClientMock.mockReturnValue({
      getBytecode: vi.fn(async () => '0x1234'),
      readContract,
    } as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        tokenIn: '0x4200000000000000000000000000000000000006',
        tokenOut: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        amountInUnits: '1',
      },
    })
    const res = createMockRes()
    const handler = await loadHandler()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.available).toBe(true)
    expect(res.body?.data?.best?.source).toBe(3)
    expect(res.body?.data?.best?.sourceLabel).toBe('UNI_V3')
    expect(res.body?.data?.amountOutUnits).toBe('3.21')
  })
})
