import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const { generateTextMock, checkRateLimitMock, createOpenAICompatibleMock, compatModelFactoryMock } =
  vi.hoisted(() => {
    const compatModelFactoryMock = vi.fn((modelId: string) => ({
      __compat: true,
      modelId,
    }))
    type CompatConfig = {
      name?: string
      baseURL?: string
      apiKey?: string
      headers?: Record<string, string>
    }
    return {
      generateTextMock: vi.fn(),
      checkRateLimitMock: vi.fn(() => ({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 })),
      createOpenAICompatibleMock: vi.fn((_config: CompatConfig) => compatModelFactoryMock),
      compatModelFactoryMock,
    }
  })

vi.mock('ai', () => ({
  generateText: generateTextMock,
}))

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: createOpenAICompatibleMock,
}))

vi.mock('@4626/server-core', async () => {
  const actual = await vi.importActual<typeof import('@4626/server-core')>('@4626/server-core')
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    checkDurableRateLimit: checkRateLimitMock,
  }
})

import handler from '../_handlers/hermit/_draft.ts'

const AUTH = { authorization: 'Bearer secret-token' }

describe('POST /api/hermit/draft', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 60_000 })
    generateTextMock.mockResolvedValue({ text: 'gm degens, vault season is on 🚀' })
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_MODEL: undefined,
      HERMIT_AGENT_SYSTEM: undefined,
      HERMIT_AGENT_PROVIDER: undefined,
      HERMIT_AGENT_BASE_URL: undefined,
      HERMIT_AGENT_API_KEY: undefined,
      OPENROUTER_API_KEY: undefined,
      AI_GATEWAY_API_KEY: 'test-key',
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('rejects non-POST methods', async () => {
    const req = createMockReq({ method: 'GET', headers: AUTH })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns 503 (fail closed) when the shared secret is unset', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({ HERMIT_AGENT_BEARER_TOKEN: undefined })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns 401 when the bearer token is missing or wrong', async () => {
    const wrong = createMockReq({ method: 'POST', headers: { authorization: 'Bearer nope' }, body: { prompt: 'hi' } })
    const wrongRes = createMockRes()
    await handler(wrong, wrongRes)
    expect(wrongRes.statusCode).toBe(401)

    const missing = createMockReq({ method: 'POST', body: { prompt: 'hi' } })
    const missingRes = createMockRes()
    await handler(missing, missingRes)
    expect(missingRes.statusCode).toBe(401)

    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns 400 when prompt is missing', async () => {
    const req = createMockReq({ method: 'POST', headers: AUTH, body: {} })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns 429 when rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns top-level { text } on success and routes the prompt through the model', async () => {
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'short hype line for the vault' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: 'gm degens, vault season is on 🚀' })
    expect(generateTextMock).toHaveBeenCalledTimes(1)
    const call = generateTextMock.mock.calls[0][0]
    expect(call.model).toBe('openai/gpt-4.1-mini')
    expect(call.prompt).toBe('short hype line for the vault')
    expect(call.maxRetries).toBe(0)
  })

  it('honors hints.model and hints.maxOutputTokens over env defaults', async () => {
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        prompt: 'meme line',
        hints: {
          route: 'meme',
          tier: 'creative_premium',
          model: 'openai/gpt-5.4-mini',
          maxOutputTokens: 320,
          timeoutMs: 8000,
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const call = generateTextMock.mock.calls[0][0]
    expect(call.model).toBe('openai/gpt-5.4-mini')
    expect(call.maxOutputTokens).toBe(320)
    expect(call.maxRetries).toBe(0)
  })

  it('routes Hermes hint through compatible provider even on gateway env', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_MODEL: 'openai/gpt-4.1-mini',
      OPENROUTER_API_KEY: 'or-key',
    })
    const req = createMockReq({
      method: 'POST',
      headers: AUTH,
      body: {
        prompt: 'gm',
        hints: { model: 'nousresearch/hermes-4-70b', maxOutputTokens: 200 },
      },
    })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(createOpenAICompatibleMock).toHaveBeenCalledTimes(1)
    expect(compatModelFactoryMock).toHaveBeenCalledWith('nousresearch/hermes-4-70b')
    expect(generateTextMock.mock.calls[0][0].maxOutputTokens).toBe(200)
  })

  it('honors HERMIT_AGENT_MODEL override', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({ HERMIT_AGENT_BEARER_TOKEN: 'secret-token', HERMIT_AGENT_MODEL: 'openai/gpt-5.4-mini' })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'yo' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(generateTextMock.mock.calls[0][0].model).toBe('openai/gpt-5.4-mini')
  })

  it('returns 502 when the model returns empty text', async () => {
    generateTextMock.mockResolvedValueOnce({ text: '   ' })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(502)
  })

  it('returns 502 when the model throws', async () => {
    generateTextMock.mockRejectedValueOnce(new Error('gateway unauthorized'))
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(502)
    expect(res.body?.error).toContain('gateway unauthorized')
  })

  it('does not use the OpenAI-compatible provider on the default gateway path', async () => {
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(createOpenAICompatibleMock).not.toHaveBeenCalled()
    expect(typeof generateTextMock.mock.calls[0][0].model).toBe('string')
  })

  it('routes Hermes through the OpenAI-compatible provider (OpenRouter) when selected', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_PROVIDER: 'openrouter',
      HERMIT_AGENT_MODEL: 'nousresearch/hermes-4-70b',
      OPENROUTER_API_KEY: 'or-key',
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'gm' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(createOpenAICompatibleMock).toHaveBeenCalledTimes(1)
    const providerArgs = createOpenAICompatibleMock.mock.calls[0][0]
    expect(providerArgs.baseURL).toBe('https://openrouter.ai/api/v1')
    expect(providerArgs.apiKey).toBe('or-key')
    expect(compatModelFactoryMock).toHaveBeenCalledWith('nousresearch/hermes-4-70b')
    expect(generateTextMock.mock.calls[0][0].model).toEqual({
      __compat: true,
      modelId: 'nousresearch/hermes-4-70b',
    })
  })

  it('honors a custom HERMIT_AGENT_BASE_URL (self-hosted Hermes) and HERMIT_AGENT_API_KEY', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_BASE_URL: 'https://hermes.internal/v1',
      HERMIT_AGENT_MODEL: 'hermes-4-70b',
      HERMIT_AGENT_API_KEY: 'self-host-key',
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'gm' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const providerArgs = createOpenAICompatibleMock.mock.calls[0][0]
    expect(providerArgs.baseURL).toBe('https://hermes.internal/v1')
    expect(providerArgs.apiKey).toBe('self-host-key')
  })

  it('returns 503 when an OpenAI-compatible provider is selected without an API key', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_PROVIDER: 'openrouter',
      HERMIT_AGENT_MODEL: 'nousresearch/hermes-4-70b',
      OPENROUTER_API_KEY: undefined,
      HERMIT_AGENT_API_KEY: undefined,
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'gm' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(createOpenAICompatibleMock).not.toHaveBeenCalled()
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('returns 503 when HERMIT_AGENT_BASE_URL is malformed', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_BASE_URL: 'not-a-url',
      HERMIT_AGENT_API_KEY: 'self-host-key',
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'gm' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(503)
    expect(generateTextMock).not.toHaveBeenCalled()
  })

  it('strips a leaked <think> reasoning block from the returned line (Hermes)', async () => {
    generateTextMock.mockResolvedValueOnce({
      text: '<think>The user wants a hype line. I should be punchy.</think>gm degens, vault season is on 🚀',
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hype line' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: 'gm degens, vault season is on 🚀' })
  })

  it('returns 502 when reasoning consumed the budget (only a truncated <think> block)', async () => {
    generateTextMock.mockResolvedValueOnce({ text: '<think>still reasoning when the token cap hit and' })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(502)
    expect(generateTextMock).toHaveBeenCalledTimes(1)
  })

  it('prepends the reasoning-suppression guard to the system prompt on the Hermes path', async () => {
    restoreEnv?.()
    restoreEnv = applyEnv({
      HERMIT_AGENT_BEARER_TOKEN: 'secret-token',
      HERMIT_AGENT_PROVIDER: 'openrouter',
      HERMIT_AGENT_MODEL: 'nousresearch/hermes-4-70b',
      OPENROUTER_API_KEY: 'or-key',
      HERMIT_AGENT_SYSTEM: 'You are Hermit, gremlin of the vault.',
    })
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'gm' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const sentSystem: string = generateTextMock.mock.calls[0][0].system
    expect(sentSystem).toContain('Do not include analysis, planning, chain-of-thought, or <think> tags')
    expect(sentSystem).toContain('You are Hermit, gremlin of the vault.')
  })

  it('does not add the reasoning guard on the gateway path', async () => {
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(generateTextMock.mock.calls[0][0].system).toBeUndefined()
  })

  it('maps a timeout/abort failure to 504', async () => {
    generateTextMock.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }))
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(504)
    expect(res.body?.error).toBe('Draft timed out')
  })

  it('maps an upstream rate-limit failure to 429', async () => {
    generateTextMock.mockRejectedValueOnce(Object.assign(new Error('rate limit exceeded'), { statusCode: 429 }))
    const req = createMockReq({ method: 'POST', headers: AUTH, body: { prompt: 'hi' } })
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(429)
    expect(res.body?.error).toBe('Upstream model rate limited')
  })
})
