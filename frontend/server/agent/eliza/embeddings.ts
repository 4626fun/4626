import { logger } from '../../_lib/logger.js'
import { assertRemoteAiEndpoint, prepareRemoteAiText } from '../../_lib/agentControl/remoteAi.js'
import { readServerEnvVar } from '../../_lib/serverEnv.js'

declare const process: { env: Record<string, string | undefined> }

type EmbeddingProvider = {
  name: string
  envKey: string
  apiUrl: string
  defaultModel: string
  modelEnvKey?: string
}

type EmbeddingAttempt = {
  provider: string
  ok: boolean
  error?: string
}

export type EmbeddingResult = {
  embedding: number[] | null
  provider: string | null
  attempts: EmbeddingAttempt[]
}

type EmbedParams = {
  text: string
  correlationId?: string
}

const PROVIDERS: EmbeddingProvider[] = [
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    apiUrl: 'https://api.openai.com/v1/embeddings',
    defaultModel: 'text-embedding-3-small',
    modelEnvKey: 'ELIZA_OPENAI_EMBED_MODEL',
  },
]

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.floor(parsed))
}

function parsePriority(raw: string | undefined): string[] {
  const fallback = ['OpenAI']
  const source = String(raw ?? '').trim()
  if (!source) return fallback
  const requested = source
    .split(/[,\s]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
  return requested.length > 0 ? requested : fallback
}

function resolveModel(provider: EmbeddingProvider): string {
  if (provider.modelEnvKey) {
    const specific = String(process.env[provider.modelEnvKey] ?? '').trim()
    if (specific) return specific
  }
  // Backward compatibility with previous runtimeBridge-specific setting.
  const legacy = String(process.env.ELIZA_SEMANTIC_RECALL_EMBED_MODEL ?? '').trim()
  if (legacy) return legacy
  return provider.defaultModel
}

class ElizaEmbeddingService {
  private readonly timeoutMs: number
  private readonly maxInputChars: number

  constructor() {
    const configuredTimeout = String(process.env.ELIZA_EMBEDDING_TIMEOUT_MS ?? '').trim()
    const legacyTimeout = String(process.env.ELIZA_SEMANTIC_RECALL_EMBED_TIMEOUT_MS ?? '').trim()
    this.timeoutMs = Math.max(1_000, parsePositiveInt(configuredTimeout || legacyTimeout, 8_000))
    this.maxInputChars = Math.max(256, parsePositiveInt(process.env.ELIZA_EMBEDDING_MAX_INPUT_CHARS, 3_000))
  }

  getAvailableProviders(): EmbeddingProvider[] {
    const available = PROVIDERS.filter((provider) => Boolean(readServerEnvVar(provider.envKey)))
    const byName = new Map(available.map((provider) => [provider.name.toLowerCase(), provider]))
    const ordered: EmbeddingProvider[] = []
    for (const name of parsePriority(process.env.ELIZA_EMBEDDING_PROVIDER_PRIORITY)) {
      const provider = byName.get(name.toLowerCase())
      if (provider) ordered.push(provider)
    }
    for (const provider of available) {
      if (!ordered.includes(provider)) ordered.push(provider)
    }
    return ordered
  }

  private async requestEmbedding(params: {
    provider: EmbeddingProvider
    apiKey: string
    text: string
  }): Promise<number[] | null> {
    const fetchImpl = (globalThis as any).fetch
    if (typeof fetchImpl !== 'function') return null
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetchImpl(assertRemoteAiEndpoint(params.provider.apiUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolveModel(params.provider),
          input: params.text,
        }),
        signal: controller.signal,
      })
      if (!response?.ok) return null
      const json = await response.json()
      const embeddingRaw = Array.isArray(json?.data?.[0]?.embedding) ? json.data[0].embedding : null
      if (!embeddingRaw || embeddingRaw.length === 0) return null
      const embedding = embeddingRaw
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value))
      return embedding.length > 0 ? embedding : null
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  async embedText(params: EmbedParams): Promise<EmbeddingResult> {
    const redacted = prepareRemoteAiText(String(params.text ?? ''), {
      maxStringLength: this.maxInputChars * 2,
      maskAddresses: true,
    })
    const text = redacted.replace(/\s+/g, ' ').trim().slice(0, this.maxInputChars)
    if (!text) return { embedding: null, provider: null, attempts: [] }
    const providers = this.getAvailableProviders()
    if (providers.length === 0) return { embedding: null, provider: null, attempts: [] }

    const attempts: EmbeddingAttempt[] = []
    for (const provider of providers) {
      const apiKey = readServerEnvVar(provider.envKey)
      if (!apiKey) continue
      const embedding = await this.requestEmbedding({
        provider,
        apiKey,
        text,
      })
      if (embedding && embedding.length > 0) {
        attempts.push({ provider: provider.name, ok: true })
        return {
          embedding,
          provider: provider.name,
          attempts,
        }
      }
      attempts.push({ provider: provider.name, ok: false, error: 'embedding_request_failed' })
      logger.warn('[eliza/embeddings] provider attempt failed (non-blocking)', {
        provider: provider.name,
        correlationId: params.correlationId ?? null,
      })
    }
    return {
      embedding: null,
      provider: null,
      attempts,
    }
  }
}

let singleton: ElizaEmbeddingService | null = null

export function getElizaEmbeddingService(): ElizaEmbeddingService {
  if (!singleton) singleton = new ElizaEmbeddingService()
  return singleton
}

export function resetElizaEmbeddingServiceForTests(): void {
  singleton = null
}
