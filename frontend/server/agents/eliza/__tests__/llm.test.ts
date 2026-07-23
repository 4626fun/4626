import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = [
  'GROQ_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'VIRTUALS_API_KEY',
  'ELIZA_LLM_MAX_RETRIES',
  'ELIZA_LLM_RETRY_BASE_MS',
  'ELIZA_LLM_TIMEOUT_MS',
  'ELIZA_DAILY_LLM_TOKEN_BUDGET',
  'ELIZA_DAILY_LLM_USD_BUDGET',
  'ELIZA_LLM_PROVIDER_PRIORITY',
  'ELIZA_LLM_COMPLEX_PROVIDER_PRIORITY',
  'ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY',
  'ELIZA_LLM_INVERSE_CHAT_PROVIDER_PRIORITY',
  'ELIZA_LLM_COMPLEX_INPUT_CHARS',
  'ELIZA_LLM_INTENT_ROUTING',
  'ELIZA_PROVIDER_CIRCUIT_FAILS',
  'ELIZA_PROVIDER_CIRCUIT_OPEN_MS',
  'ELIZA_GROQ_MODEL',
  'ELIZA_OPENAI_MODEL',
  'ELIZA_ANTHROPIC_MODEL',
  'ELIZA_OPENROUTER_MODEL',
  'ELIZA_VIRTUALSCOMPUTE_MODEL',
]

function clearLlmEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe('eliza llm service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    clearLlmEnv()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearLlmEnv()
  })

  it('falls back to the next provider when first provider fails', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ELIZA_LLM_MAX_RETRIES = '1'
    process.env.ELIZA_LLM_RETRY_BASE_MS = '1'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('groq.com')) {
        return new Response(JSON.stringify({ error: 'upstream down' }), { status: 500 })
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'fallback response' } }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'agent-1',
      userMessage: 'hello',
      systemPrompt: 'system',
      vaultContext: 'context',
      correlationId: 'corr-1',
    })

    expect(result.provider).toBe('OpenAI')
    expect(result.text).toBe('fallback response')
    expect(result.attempts.map((x) => x.provider)).toEqual(['Groq', 'OpenAI'])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('uses provider-native model when preferred model is incompatible', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}'))
      expect(body.model).toBe('llama-3.3-70b-versatile')
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'groq response' } }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'agent-model-compat',
      userMessage: 'quick response',
      systemPrompt: 'system',
      vaultContext: 'context',
      correlationId: 'corr-model-compat',
      preferredModel: 'gpt-4o-mini',
    })

    expect(result.provider).toBe('Groq')
    expect(result.text).toBe('groq response')
    expect(result.attempts[0]?.model).toBe('llama-3.3-70b-versatile')
  })

  it('routes inverse chat classifier with OpenRouter-first priority', async () => {
    process.env.VIRTUALS_API_KEY = 'virtuals-key'
    process.env.OPENROUTER_API_KEY = 'openrouter-key'
    process.env.ELIZA_LLM_INVERSE_CHAT_PROVIDER_PRIORITY = 'OpenRouter,VirtualsCompute'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"verdict":"skip","reason":"ok"}' } }],
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ error: 'virtuals down' }), { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'inverse-akita-chat-classifier',
      userMessage: 'btc looking bullish today',
      systemPrompt: 'classify',
      vaultContext: '',
      correlationId: 'corr-inverse-chat',
    })

    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toContain('openrouter.ai')
    expect(result.provider).toBe('OpenRouter')
    expect(result.text).toContain('verdict')
  })

  it('returns null instead of throwing when the shared abort signal fires', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '5_000'

    const controller = new AbortController()
    controller.abort()

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'should not run' } }] }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'agent-aborted',
      userMessage: 'hello',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-aborted',
      abortSignal: controller.signal,
    })

    expect(result.text).toBeNull()
    expect(result.provider).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not count in-flight client cancellations against the provider circuit', async () => {
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ELIZA_LLM_PROVIDER_PRIORITY = 'OpenAI'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '5_000'
    process.env.ELIZA_PROVIDER_CIRCUIT_FAILS = '1'
    process.env.ELIZA_PROVIDER_CIRCUIT_OPEN_MS = '60000'

    let cancelled = false
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (!cancelled) {
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            cancelled = true
            reject(new DOMException('aborted', 'AbortError'))
          }, { once: true })
        })
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'provider remains healthy' } }] }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const controller = new AbortController()
    const cancelledRequest = service.generateResponse({
      agentKey: 'agent-client-abort',
      userMessage: 'hello',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-client-abort',
      abortSignal: controller.signal,
    })
    await Promise.resolve()
    controller.abort()

    const cancelledResult = await cancelledRequest
    expect(cancelledResult.attempts[0]?.error).toBe('request_cancelled')

    const healthyResult = await service.generateResponse({
      agentKey: 'agent-client-abort',
      userMessage: 'hello again',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-after-client-abort',
    })
    expect(healthyResult.text).toBe('provider remains healthy')
    expect(healthyResult.attempts[0]?.error).not.toBe('circuit_open')
  })

  it('routes complex prompts with complex-provider priority', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ANTHROPIC_API_KEY = 'anthropic-key'
    process.env.ELIZA_LLM_PROVIDER_PRIORITY = 'Groq,OpenAI,Anthropic'
    process.env.ELIZA_LLM_COMPLEX_PROVIDER_PRIORITY = 'Anthropic,Groq,OpenAI'
    process.env.ELIZA_LLM_COMPLEX_INPUT_CHARS = '20'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('anthropic.com')) {
        return new Response(
          JSON.stringify({
            content: [{ text: 'anthropic complex response' }],
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'fallback response' } }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'agent-complex-priority',
      userMessage: 'Analyze portfolio risk and strategy rebalance options.',
      systemPrompt: 'system',
      vaultContext: 'context',
      correlationId: 'corr-complex-priority',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toContain('anthropic.com')
    expect(result.provider).toBe('Anthropic')
    expect(result.text).toBe('anthropic complex response')
  })

  it('disables redirect following for remote ai requests', async () => {
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ELIZA_LLM_PROVIDER_PRIORITY = 'OpenAI'
    process.env.ELIZA_LLM_MAX_RETRIES = '0'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.redirect).toBe('error')
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'redirect-safe response' } }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()
    const result = await service.generateResponse({
      agentKey: 'agent-redirect-safe',
      userMessage: 'hello',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-redirect-safe',
    })

    expect(result.provider).toBe('OpenAI')
    expect(result.text).toBe('redirect-safe response')
  })

  it('blocks requests when daily token budget is exceeded before network call', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.ELIZA_DAILY_LLM_TOKEN_BUDGET = '1'
    process.env.ELIZA_LLM_MAX_RETRIES = '1'
    process.env.ELIZA_LLM_RETRY_BASE_MS = '1'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'unused' } }] }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()

    await expect(
      service.generateResponse({
        agentKey: 'agent-2',
        userMessage: 'this definitely exceeds one token',
        systemPrompt: 'system prompt',
        vaultContext: 'vault context',
        correlationId: 'corr-2',
      }),
    ).rejects.toMatchObject({
      code: 'BUDGET_EXCEEDED',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('opens provider circuit after threshold and skips provider while open', async () => {
    process.env.OPENAI_API_KEY = 'openai-key'
    process.env.ELIZA_LLM_PROVIDER_PRIORITY = 'OpenAI'
    process.env.ELIZA_LLM_MAX_RETRIES = '1'
    process.env.ELIZA_LLM_RETRY_BASE_MS = '1'
    process.env.ELIZA_LLM_TIMEOUT_MS = '250'
    process.env.ELIZA_PROVIDER_CIRCUIT_FAILS = '1'
    process.env.ELIZA_PROVIDER_CIRCUIT_OPEN_MS = '60000'

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'upstream down' }), { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaLlmService } = await import('../llm.ts')
    const service = getElizaLlmService()

    const first = await service.generateResponse({
      agentKey: 'agent-3',
      userMessage: 'hello',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-3a',
    })
    expect(first.text).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const second = await service.generateResponse({
      agentKey: 'agent-3',
      userMessage: 'hello again',
      systemPrompt: 'system',
      vaultContext: '',
      correlationId: 'corr-3b',
    })
    expect(second.text).toBeNull()
    expect(second.attempts[0]?.error).toBe('circuit_open')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
