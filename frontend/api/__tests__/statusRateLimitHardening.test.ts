import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/status/_vaultReport.ts'
import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  multicall: vi.fn(async () => [
    { status: 'failure', error: new Error('429 rate limit from upstream RPC') },
  ]),
  readContract: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: mocks.handleOptions,
  setCors: mocks.setCors,
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      multicall: mocks.multicall,
      readContract: mocks.readContract,
    })),
    http: vi.fn(() => ({})),
    isAddress: vi.fn(() => true),
    erc20Abi: [],
  }
})

describe('status endpoint rate-limit hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    mocks.multicall.mockResolvedValue([
      { status: 'failure', error: new Error('429 rate limit from upstream RPC') },
    ])
  })

  it('returns 429 + Retry-After when _vaultReport receives RPC rate-limit failures', async () => {
    const req = createMockReq({
      method: 'GET',
      query: { vault: '0x1111111111111111111111111111111111111111' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Rate limited by RPC')
    expect(String(res.getHeader('retry-after') ?? '')).toBe('5')
  })
})
