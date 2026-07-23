import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes, withAuthHeader } from './helpers'

const mocks = vi.hoisted(() => ({
  checkDurableRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 1,
    resetAt: Date.now() + 60_000,
    source: 'db',
  })),
  find: vi.fn(async () => ({ version: null, attempts: 100_000 })),
}))

vi.mock('@4626/server-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@4626/server-core')>()),
  checkDurableRateLimit: mocks.checkDurableRateLimit,
  getClientIp: () => '127.0.0.1',
}))

vi.mock('../../server/_lib/deploy/findPerVaultVanityVersionServer.js', () => ({
  findPerVaultVanityVersionOnServer: mocks.find,
  readCombinedVanityServerMaxAttempts: () => 100_000,
}))

import handler from '../_handlers/deploy/_vanityPerVaultVersion.js'

const ALICE = '0x1111111111111111111111111111111111111111'
const BOB = '0x2222222222222222222222222222222222222222'

function body(owner = ALICE) {
  return {
    create2Deployer: '0x3333333333333333333333333333333333333333',
    creatorToken: '0x4444444444444444444444444444444444444444',
    owner,
    chainId: 8453,
    baseVersion: 'v1',
    vaultPrefix: 'abc',
    shareSuffix: null,
    startAttempt: 0,
    maxAttempts: 50_000_000,
    vaultInitCode: '0x6000',
    shareOftInitCode: '0x6000',
    shareSymbol: 'SHARE',
  }
}

describe('deploy vanity endpoint security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.checkDurableRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 1,
      resetAt: Date.now() + 60_000,
      source: 'db',
    })
    mocks.find.mockResolvedValue({ version: null, attempts: 100_000 })
  })

  it('binds the requested deploy owner to the authenticated principal', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({}, ALICE),
      body: body(BOB),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('hard-caps the compute window even when the caller asks for more', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({}, ALICE),
      body: body(ALICE),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({ owner: ALICE, maxTries: 100_000 }),
    )
  })

  it('fails before compute when the durable limiter denies the request', async () => {
    mocks.checkDurableRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: 'fail-closed',
    })
    const req = createMockReq({
      method: 'POST',
      headers: withAuthHeader({}, ALICE),
      body: body(ALICE),
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(mocks.find).not.toHaveBeenCalled()
  })
})
