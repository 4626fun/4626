import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { generateResponseMock, getElizaLlmServiceMock } = vi.hoisted(() => ({
  generateResponseMock: vi.fn(),
  getElizaLlmServiceMock: vi.fn(),
}))

vi.mock('../../server/agent/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))

describe('agent creative handler', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({ AGENT_CREATIVE_ENABLE_LLM: '0' })
    generateResponseMock.mockResolvedValue({
      text: null,
      provider: null,
      attempts: [],
    })
    getElizaLlmServiceMock.mockReturnValue({
      generateResponse: generateResponseMock,
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 405 for non-POST requests', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'GET',
      query: {},
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(405)
    expect(res.body).toEqual({ success: false, error: 'Method not allowed' })
  })

  it('returns 400 for invalid request shape', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: { mode: 'referral_og' },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body).toEqual({ success: false, error: 'Invalid request body' })
  })

  it('returns 413 when context exceeds size limit', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
          big: 'x'.repeat(30_000),
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(413)
    expect(res.body).toEqual({ success: false, error: 'Creative context too large' })
  })

  it('returns 429 when creative endpoint rate limit is exceeded', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const firstReq = createMockReq({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: {
        mode: 'referral_og',
        context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
      },
      url: '/api/agent/creative',
    })
    const firstRes = createMockRes()
    await handler(firstReq, firstRes)
    expect(firstRes.statusCode).toBe(200)

    const limitHeader = firstRes.getHeader('x-ratelimit-limit')
    const limit = Number(Array.isArray(limitHeader) ? limitHeader[0] : limitHeader)
    expect(Number.isFinite(limit)).toBe(true)
    expect(limit).toBeGreaterThan(0)

    for (let i = 1; i < limit; i += 1) {
      const req = createMockReq({
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.50' },
        body: {
          mode: 'referral_og',
          context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
        },
        url: '/api/agent/creative',
      })
      const res = createMockRes()
      await handler(req, res)
      expect(res.statusCode).toBe(200)
    }

    const req = createMockReq({
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: {
        mode: 'referral_og',
        context: { handle: 'akita', campaign: 'creator-vault', tier: 'supporter' },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.body).toEqual({ success: false, error: 'Rate limit exceeded' })
  })

  it('returns missing_required_context envelope for missing fields', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: { handle: 'akita' },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: false,
      mode: 'referral_og',
      version: 'v1',
      error: 'missing_required_context',
      missing: ['campaign', 'tier'],
    })
  })

  it('enforces quest rule: same tier cannot be locked', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'quest_reward',
        context: {
          currentTier: 'supporter',
          targetTier: 'supporter',
          requiredActions: ['follow', 'share', 'mint'],
          verifiedActions: ['follow'],
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mode).toBe('quest_reward')
    expect(res.body.result.tier).toBe('supporter')
    expect(res.body.result.status).toBe('unlocked')
  })

  it('sets locked only when target tier differs and requirements are incomplete', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'quest_reward',
        context: {
          currentTier: 'supporter',
          targetTier: 'boosted',
          requiredActions: ['follow', 'share', 'mint'],
          verifiedActions: ['follow', 'share'],
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mode).toBe('quest_reward')
    expect(res.body.result.tier).toBe('boosted')
    expect(res.body.result.status).toBe('locked')
  })

  it('returns deterministic share_page_copy payload shape', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'share_page_copy',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      mode: 'share_page_copy',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        title: expect.any(String),
        subtitle: expect.any(String),
        body_short: expect.any(String),
        cta: expect.any(String),
      },
    })
  })

  it('returns deterministic metadata_bundle payload shape', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'metadata_bundle',
        context: {
          asset_type: 'og',
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
          tags: ['creator-vault', 'supporter'],
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      mode: 'metadata_bundle',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        asset_type: 'og',
        title: expect.any(String),
        description: expect.any(String),
        alt: expect.any(String),
        tags: expect.any(Array),
        filename_hint: expect.any(String),
        pinata_metadata: {
          name: expect.any(String),
          keyvalues: expect.any(Object),
        },
      },
    })
  })

  it('accepts legacy input payload key as compatibility adapter', async () => {
    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        input: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      mode: 'referral_og',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        headline: expect.any(String),
      },
    })
  })

  it('accepts valid llm envelope when enabled', async () => {
    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({ AGENT_CREATIVE_ENABLE_LLM: '1' })
    generateResponseMock.mockResolvedValue({
      text: JSON.stringify({
        ok: true,
        mode: 'referral_og',
        version: 'v1',
        voice: 'premium_dark_crypto',
        result: {
          headline: '@akita · Supporter Access',
          subheadline: 'Creator Vault creative for aligned upside.',
          cta: 'Open Supporter Card',
          visual_direction: ['obsidian backdrop', 'metallic accent glow'],
          keywords: ['creator vault', 'supporter'],
        },
      }),
      provider: 'OpenAI',
      attempts: [{ provider: 'OpenAI', ok: true }],
    })

    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(generateResponseMock).toHaveBeenCalledOnce()
    expect(res.body).toEqual({
      ok: true,
      mode: 'referral_og',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        headline: '@akita · Supporter Access',
        subheadline: 'Creator Vault creative for aligned upside.',
        cta: 'Open Supporter Card',
        visual_direction: ['obsidian backdrop', 'metallic accent glow'],
        keywords: ['creator vault', 'supporter'],
      },
    })
  })

  it('rejects llm verification wording without verification flags', async () => {
    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({ AGENT_CREATIVE_ENABLE_LLM: '1' })
    generateResponseMock.mockResolvedValue({
      text: JSON.stringify({
        ok: true,
        mode: 'referral_og',
        version: 'v1',
        voice: 'premium_dark_crypto',
        result: {
          headline: '@akita verified supporter access',
          subheadline: 'Confirmed premium access path.',
          cta: 'Open Supporter Card',
          visual_direction: ['obsidian backdrop', 'metallic accent glow'],
          keywords: ['creator vault', 'supporter'],
        },
      }),
      provider: 'OpenAI',
      attempts: [{ provider: 'OpenAI', ok: true }],
    })

    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mode).toBe('referral_og')
    expect(res.body.result.headline).not.toMatch(/verified|confirmed|validated|proven|claimed|unlocked/i)
  })

  it('allows llm verification wording when explicit verification flags exist', async () => {
    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({ AGENT_CREATIVE_ENABLE_LLM: '1' })
    generateResponseMock.mockResolvedValue({
      text: JSON.stringify({
        ok: true,
        mode: 'referral_og',
        version: 'v1',
        voice: 'premium_dark_crypto',
        result: {
          headline: '@akita verified supporter access',
          subheadline: 'Verified social path is complete.',
          cta: 'Open Supporter Card',
          visual_direction: ['obsidian backdrop', 'metallic accent glow'],
          keywords: ['creator vault', 'supporter'],
        },
      }),
      provider: 'OpenAI',
      attempts: [{ provider: 'OpenAI', ok: true }],
    })

    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
          verified: true,
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      ok: true,
      mode: 'referral_og',
      version: 'v1',
      voice: 'premium_dark_crypto',
      result: {
        headline: '@akita verified supporter access',
        subheadline: 'Verified social path is complete.',
        cta: 'Open Supporter Card',
        visual_direction: ['obsidian backdrop', 'metallic accent glow'],
        keywords: ['creator vault', 'supporter'],
      },
    })
  })

  it('falls back to deterministic envelope for invalid llm output', async () => {
    if (restoreEnv) restoreEnv()
    restoreEnv = applyEnv({ AGENT_CREATIVE_ENABLE_LLM: '1' })
    generateResponseMock.mockResolvedValue({
      text: JSON.stringify({
        mode: 'referral_og',
        input: { handle: 'akita' },
        output: { title: 'wrapper-shape' },
      }),
      provider: 'OpenAI',
      attempts: [{ provider: 'OpenAI', ok: true }],
    })

    const mod = await import('../_handlers/agent/_creative.ts')
    const handler = mod.default

    const req = createMockReq({
      method: 'POST',
      body: {
        mode: 'referral_og',
        context: {
          handle: 'akita',
          campaign: 'creator-vault',
          tier: 'supporter',
        },
      },
      url: '/api/agent/creative',
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.mode).toBe('referral_og')
    expect(res.body.version).toBe('v1')
    expect(res.body.voice).toBe('premium_dark_crypto')
    expect(res.body).not.toHaveProperty('input')
    expect(res.body).not.toHaveProperty('output')
    expect(res.body.result).toMatchObject({
      headline: expect.any(String),
      subheadline: expect.any(String),
      cta: expect.any(String),
      visual_direction: expect.any(Array),
      keywords: expect.any(Array),
    })
  })
})
