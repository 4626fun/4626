import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENV_KEYS = [
  'OPENAI_API_KEY',
  'ELIZA_EMBEDDING_PROVIDER_PRIORITY',
  'ELIZA_OPENAI_EMBED_MODEL',
  'ELIZA_EMBEDDING_TIMEOUT_MS',
]

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key]
}

describe('eliza embedding service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    clearEnv()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearEnv()
  })

  it('returns no providers when no embedding credentials are configured', async () => {
    const { getElizaEmbeddingService } = await import('../embeddings.ts')
    const service = getElizaEmbeddingService()
    expect(service.getAvailableProviders()).toEqual([])
  })

  it('embeds text with OpenAI when configured', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key'
    process.env.ELIZA_EMBEDDING_PROVIDER_PRIORITY = 'OpenAI'

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaEmbeddingService } = await import('../embeddings.ts')
    const service = getElizaEmbeddingService()
    const result = await service.embedText({
      text: 'hello world',
      correlationId: 'embed-1',
    })

    expect(result.provider).toBe('OpenAI')
    expect(result.embedding).toEqual([0.1, 0.2, 0.3])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0] ?? '')).toContain('/v1/embeddings')
  })

  it('returns null embedding when upstream fails', async () => {
    process.env.OPENAI_API_KEY = 'openai-test-key'

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'upstream down' }), { status: 500 })
    })
    vi.stubGlobal('fetch', fetchMock as any)

    const { getElizaEmbeddingService } = await import('../embeddings.ts')
    const service = getElizaEmbeddingService()
    const result = await service.embedText({
      text: 'hello world',
      correlationId: 'embed-2',
    })

    expect(result.provider).toBeNull()
    expect(result.embedding).toBeNull()
  })
})
