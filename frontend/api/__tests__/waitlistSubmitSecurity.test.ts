import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/_waitlist.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readRequestPrincipalAddressMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getClientIpMock,
  isCswOwnerMock,
} = vi.hoisted(() => ({
  readRequestPrincipalAddressMock: vi.fn(() => '0x00000000000000000000000000000000000000aa'),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn(() => 'waitlist:test'),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  isCswOwnerMock: vi.fn(async () => true),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  RATE_LIMITS: { waitlistSignup: { windowMs: 60_000, maxRequests: 5 } },
  checkRateLimit: checkRateLimitMock,
  rateLimitKey: rateLimitKeyMock,
  getClientIp: getClientIpMock,
}))

vi.mock('../../server/_lib/cswOwner.js', () => ({
  isCswOwner: isCswOwnerMock,
}))

describe('waitlist submit security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isCswOwnerMock.mockResolvedValue(true)
  })

  it('binds to authenticated principal even when submitted wallet differs', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000aa')

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'akitav2@proton.me',
        primaryWallet: '0x00000000000000000000000000000000000000bb',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    // The handler should not hard-fail on client-submitted wallet mismatch.
    expect(res.statusCode).not.toBe(403)
    expect(String(res.body?.error ?? '')).not.toContain('match authenticated wallet')
  })

  it('requires trusted wallet verification for creator submissions', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('')

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'creator@noemail.4626.fun',
        intent: { persona: 'creator', hasCreatorCoin: true },
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Wallet verification is required')
  })

  it('rejects CSW submit when authenticated principal is not an owner', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000aa')
    isCswOwnerMock.mockResolvedValueOnce(false)

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'akitav2@proton.me',
        primaryWallet: '0x00000000000000000000000000000000000000aa',
        cswAddress: '0x00000000000000000000000000000000000000bb',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Submitted CSW must be owned')
  })

  it('skips owner check when principal already equals submitted CSW', async () => {
    readRequestPrincipalAddressMock.mockReturnValueOnce('0x00000000000000000000000000000000000000bb')

    const req = createMockReq({
      method: 'POST',
      body: {
        email: 'akitav2@proton.me',
        primaryWallet: '0x00000000000000000000000000000000000000bb',
        cswAddress: '0x00000000000000000000000000000000000000bb',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(isCswOwnerMock).not.toHaveBeenCalled()
    expect(res.statusCode).not.toBe(403)
    expect(String(res.body?.error ?? '')).not.toContain('Submitted CSW must be owned')
  })
})
