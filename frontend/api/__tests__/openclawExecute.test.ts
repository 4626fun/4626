import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const mocks = vi.hoisted(() => ({
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(),
  guardAgentApiRequest: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  setCors: mocks.setCors,
  setNoStore: mocks.setNoStore,
  handleOptions: mocks.handleOptions,
  readJsonBody: mocks.readJsonBody,
}))

vi.mock('../../server/_lib/agentApiGuard.js', () => ({
  guardAgentApiRequest: mocks.guardAgentApiRequest,
}))

vi.mock('../../server/uniswap/agentSkills.js', () => ({
  executeUniswapSkill: vi.fn(),
}))

const creativeMocks = vi.hoisted(() => ({
  generateCreativeEnvelope: vi.fn(),
  getCreativeContextValidationError: vi.fn(),
}))

vi.mock('../_handlers/agent/_creative.js', () => ({
  generateCreativeEnvelope: creativeMocks.generateCreativeEnvelope,
  getCreativeContextValidationError: creativeMocks.getCreativeContextValidationError,
}))

vi.mock('../../server/_lib/agentRegistration.js', () => ({
  buildAgentRegistration: vi.fn(() => ({ payload: null })),
}))

vi.mock('../../server/_lib/agentRegistrationPublisher.js', () => ({
  publishAgentRegistrationToGrove: vi.fn(),
  resolveAgentRegistrationKey: vi.fn(),
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: vi.fn(),
}))

vi.mock('../../server/_lib/lensAccounts.js', () => ({
  resolveLensUserByOwner: vi.fn(),
}))

vi.mock('../../server/_lib/lensGrove.js', () => ({
  tryUploadImmutableJson: vi.fn(),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://4626.fun'),
}))

vi.mock('../../server/_lib/shareTokenMetadata.js', () => ({
  buildShareTokenMetadata: vi.fn(),
}))

vi.mock('../../server/zora/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/zora/_shared.js')>('../../server/zora/_shared.js')
  return {
    ...actual,
    requireServerKey: vi.fn(() => null),
  }
})

describe('openclaw execute handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handleOptions.mockReturnValue(false)
    creativeMocks.getCreativeContextValidationError.mockReturnValue(null)
    creativeMocks.generateCreativeEnvelope.mockResolvedValue({
      ok: true,
      mode: 'referral_og',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        headline: '@akita · Supporter Access',
        subheadline: 'Creator Vault creative.',
        cta: 'Open Supporter Card',
        visual_direction: ['obsidian', 'metallic'],
        keywords: ['creator vault', 'supporter'],
      },
    })
  })

  it('enforces guard before parsing payload', async () => {
    mocks.guardAgentApiRequest.mockImplementationOnce(async ({ res }: { res: any }) => {
      res.status(401).json({ success: false, error: 'Authentication required' })
      return { ok: false, ip: '127.0.0.1' }
    })
    mocks.readJsonBody.mockResolvedValue({ tool: 'wallet_portfolio', input: {} })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(mocks.readJsonBody).not.toHaveBeenCalled()
  })

  it('returns unknown tool error after successful guard', async () => {
    mocks.guardAgentApiRequest.mockResolvedValueOnce({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    mocks.readJsonBody.mockResolvedValueOnce({ tool: 'unknown_tool', input: {} })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('unknown tool')
    expect(mocks.guardAgentApiRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'openclaw/execute',
        kind: 'build',
      }),
    )
  })

  it('returns 413 for oversized creative context before adapter execution', async () => {
    mocks.guardAgentApiRequest.mockResolvedValueOnce({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    creativeMocks.getCreativeContextValidationError.mockReturnValueOnce('Creative context too large')
    mocks.readJsonBody.mockResolvedValueOnce({
      tool: 'referral_og',
      input: {
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
          big: 'x'.repeat(30_000),
        },
      },
    })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(413)
    expect(res.body).toEqual({ success: false, error: 'Creative context too large' })
    expect(creativeMocks.generateCreativeEnvelope).not.toHaveBeenCalled()
  })

  it('returns 429 when openclaw creative adapter rate limit is exceeded', async () => {
    const actorAddress = '0x9999999999999999999999999999999999999999'
    const actorIp = '203.0.113.77'
    mocks.guardAgentApiRequest.mockResolvedValue({
      ok: true,
      ip: actorIp,
      auth: { type: 'session', address: actorAddress },
    })
    mocks.readJsonBody.mockResolvedValue({
      tool: 'referral_og',
      input: {
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
    })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')

    const firstReq = createMockReq({ method: 'POST', body: null })
    const firstRes = createMockRes()
    await handler(firstReq, firstRes)
    expect(firstRes.statusCode).toBe(200)
    const limitHeader = firstRes.getHeader('x-openclaw-creative-ratelimit-limit')
    const limit = Number(Array.isArray(limitHeader) ? limitHeader[0] : limitHeader)
    expect(Number.isFinite(limit)).toBe(true)
    expect(limit).toBeGreaterThan(0)

    for (let i = 1; i < limit; i += 1) {
      const req = createMockReq({ method: 'POST', body: null })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
    }

    const overflowReq = createMockReq({ method: 'POST', body: null })
    const overflowRes = createMockRes()
    await handler(overflowReq, overflowRes)

    expect(overflowRes.statusCode).toBe(429)
    expect(overflowRes.body).toEqual({ success: false, error: 'Creative adapter rate limit exceeded' })
    expect(creativeMocks.generateCreativeEnvelope).toHaveBeenCalledTimes(limit)
  })

  it('routes creative tools through strict creative adapter', async () => {
    mocks.guardAgentApiRequest.mockResolvedValueOnce({
      ok: true,
      ip: '127.0.0.1',
      auth: { type: 'session', address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    mocks.readJsonBody.mockResolvedValueOnce({
      tool: 'referral_og',
      input: {
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
    })

    const { default: handler } = await import('../_handlers/openclaw/_execute.ts')
    const req = createMockReq({ method: 'POST', body: null })
    const res = createMockRes()

    await handler(req, res)

    expect(creativeMocks.generateCreativeEnvelope).toHaveBeenCalledWith({
      mode: 'referral_og',
      context: {
        handle: 'akita',
        campaign: 'creator-vault',
        tier: 'supporter',
      },
      allowLlm: false,
    })
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      ok: true,
      mode: 'referral_og',
      version: 'v1',
      voice: 'premium_dark_crypto',
    })
  })
})
