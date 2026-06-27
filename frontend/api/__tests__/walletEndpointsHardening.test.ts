import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  readBoundedJsonObjectBodyMock,
  readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipalMock,
  getDbMock,
  bootstrapCanonicalDelegationStateMock,
  confirmOwnerStateMock,
  extractDelegationFlagsMock,
} = vi.hoisted(() => ({
  checkRateLimitMock: vi.fn(() => ({ allowed: false, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '203.0.113.42'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: any) => req.body ?? null),
  readRequestPrincipalAddressMock: vi.fn(() => '0x0000000000000000000000000000000000000001'),
  resolveAuthorizedRequestPrincipalMock: vi.fn(async () => ({ profileId: 42 })),
  getDbMock: vi.fn(async () => ({ sql: vi.fn(async () => ({ rows: [] })) })),
  bootstrapCanonicalDelegationStateMock: vi.fn(async () => ({
    chainId: 8453,
    canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
    privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
    privyIsOwner: false,
  })),
  confirmOwnerStateMock: vi.fn(async () => ({
    isOwner: false,
    canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
    ownerAddress: '0x00000000000000000000000000000000000000bb',
    confirmationState: 'owner_not_found_yet',
  })),
  extractDelegationFlagsMock: vi.fn(() => ({})),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  readJsonBody: readBoundedJsonObjectBodyMock,
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
  resolveAuthorizedRequestPrincipal: resolveAuthorizedRequestPrincipalMock,
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    cswLink: { windowMs: 60_000, maxRequests: 20 },
    solanaSetCanonical: { windowMs: 60_000, maxRequests: 30 },
    solanaSweepEnqueue: { windowMs: 60_000, maxRequests: 20 },
    solanaSweepProcess: { windowMs: 60_000, maxRequests: 30 },
  },
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/infra/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    cswLink: { windowMs: 60_000, maxRequests: 20 },
  },
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/wallet/walletSync.js', () => ({
  syncUserWallets: vi.fn(async () => ({
    canonicalSmartWallet: null,
    canonicalSolanaWallet: null,
    operationalSolanaWallet: null,
    embeddedEoa: null,
    connectedWallets: [],
  })),
}))

vi.mock('../../server/_lib/onchain/solanaSweepJobs.js', () => ({
  enqueueSolanaSweepJob: vi.fn(async () => ({ id: 1, status: 'queued', min_lamports: 0n })),
  processSolanaSweepJobs: vi.fn(async () => ({
    processed: 0,
    succeeded: 0,
    retried: 0,
    blocked: 0,
    failed: 0,
    jobIds: [],
  })),
}))

vi.mock('../../server/_lib/wallet/canonicalCswDelegation.js', () => ({
  bootstrapCanonicalDelegationState: bootstrapCanonicalDelegationStateMock,
  confirmOwnerState: confirmOwnerStateMock,
  extractDelegationFlags: extractDelegationFlagsMock,
}))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    getUserById = vi.fn(async () => ({ id: 'did:privy:test-user', linkedAccounts: [] }))
  },
}))

describe('wallet endpoint hardening', () => {
  const originalProcessorSecret = process.env.SOLANA_SWEEP_PROCESSOR_SECRET

  beforeEach(() => {
    // Vitest 4: clearAllMocks no longer drops queued mockReturnValueOnce stubs,
    // so unconsumed once-stubs (e.g. from 401 tests whose handlers return
    // before reaching the rate limiter) would leak into later tests. resetAllMocks
    // clears those queues and restores the original hoisted implementations.
    vi.resetAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: false, resetAt: Date.now() + 60_000 })
    readRequestPrincipalAddressMock.mockReturnValue('0x0000000000000000000000000000000000000001')
    readBoundedJsonObjectBodyMock.mockImplementation(async (req: any) => req.body ?? null)
    bootstrapCanonicalDelegationStateMock.mockResolvedValue({
      chainId: 8453,
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      privyEmbeddedEoaAddress: '0x00000000000000000000000000000000000000bb',
      privyIsOwner: false,
    })
    confirmOwnerStateMock.mockResolvedValue({
      isOwner: false,
      canonicalCswAddress: '0x00000000000000000000000000000000000000aa',
      ownerAddress: '0x00000000000000000000000000000000000000bb',
      confirmationState: 'owner_not_found_yet',
    })
    process.env.SOLANA_SWEEP_PROCESSOR_SECRET = 'processor-secret'
  })

  afterEach(() => {
    if (originalProcessorSecret == null) {
      delete process.env.SOLANA_SWEEP_PROCESSOR_SECRET
    } else {
      process.env.SOLANA_SWEEP_PROCESSOR_SECRET = originalProcessorSecret
    }
  })

  it('returns 429 + Retry-After from wallet sync when rate limited', async () => {
    const { default: handler } = await import('../_handlers/wallet/_sync.ts')
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Rate limit exceeded')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 401 from wallet sync when request principal is missing', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: true, resetAt: Date.now() + 60_000 })
    readRequestPrincipalAddressMock.mockReturnValueOnce(null as any)

    const { default: handler } = await import('../_handlers/wallet/_sync.ts')
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Not authenticated')
  })

  it('returns 401 from solana setCanonical when principal is missing', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: true, resetAt: Date.now() + 60_000 })
    readRequestPrincipalAddressMock.mockReturnValueOnce(null as any)

    const { default: handler } = await import('../_handlers/wallet/solana/_setCanonical.ts')
    const req = createMockReq({ method: 'POST', body: { wallet: '11111111111111111111111111111111' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Not authenticated')
  })

  it('returns 429 + Retry-After from solana setCanonical when rate limited', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x0000000000000000000000000000000000000001')
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 60_000 })

    const { default: handler } = await import('../_handlers/wallet/solana/_setCanonical.ts')
    const req = createMockReq({ method: 'POST', body: { wallet: '11111111111111111111111111111111' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many canonical wallet updates')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 401 from solana sweep enqueue when principal is missing', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: true, resetAt: Date.now() + 60_000 })
    readRequestPrincipalAddressMock.mockReturnValueOnce(null as any)

    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_enqueue.ts')
    const req = createMockReq({ method: 'POST', body: { minLamports: 1 } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Not authenticated')
  })

  it('returns 429 + Retry-After from solana sweep enqueue when rate limited', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x0000000000000000000000000000000000000001')
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 60_000 })

    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_enqueue.ts')
    const req = createMockReq({ method: 'POST', body: { minLamports: 1 } })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many sweep requests')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('returns 401 from solana sweep process when bearer token is missing', async () => {
    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_process.ts')
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Unauthorized')
  })

  it('returns 429 + Retry-After from solana sweep process when rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 60_000 })

    const { default: handler } = await import('../_handlers/wallet/solana/sweep/_process.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { authorization: 'Bearer processor-secret' },
      body: {},
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many processor requests')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })
})
