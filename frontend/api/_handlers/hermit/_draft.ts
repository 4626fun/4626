import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateText, type LanguageModel } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'

/**
 * Hermit creative brain — first-party replacement for the retired Pinata
 * OpenClaw route.
 *
 * Contract (matches `runPinataDraftOverHttp` in
 * `server/_lib/hermit/skillRouter.ts`): authenticated `POST { prompt }`,
 * responds with a top-level `{ text }`. The skill router owns persona and
 * room context inside `prompt`; this endpoint only relays the prompt to a
 * model and returns the generated line.
 *
 * Two model backends, selected by `HERMIT_AGENT_PROVIDER`:
 *   - `gateway` (default): pass `HERMIT_AGENT_MODEL` as a plain `provider/model`
 *     string to the Vercel AI Gateway (`generateText({ model: '<string>' })`).
 *   - `openai-compatible` / `openrouter`: route to any OpenAI-compatible
 *     endpoint (OpenRouter, Together, Fireworks, self-hosted vLLM/SGLang) via
 *     `HERMIT_AGENT_BASE_URL` + `HERMIT_AGENT_API_KEY`. This is the path for
 *     Nous Hermes (e.g. `nousresearch/hermes-4-70b`), which the AI Gateway
 *     catalog does not carry.
 *
 * Auth: shared bearer (`HERMIT_AGENT_BEARER_TOKEN`) — the same token the
 * router/agent sends as `HERMIT_AGENT_CHAT_ENDPOINT` callers. Fails closed
 * when the secret is unset so an unauthenticated caller can never spend
 * model credits.
 */

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'
const DEFAULT_TIMEOUT_MS = 25_000
const MAX_PROMPT_BYTES = 24_576
const MAX_PROMPT_CHARS = 8_000
const MAX_OUTPUT_TOKENS_DEFAULT = 400
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type ModelResolution =
  | { ok: true; model: LanguageModel }
  | { ok: false; status: number; error: string }

/**
 * Resolve the model backend from env. Returns a plain string for the AI Gateway
 * path (the SDK resolves it against the global gateway) or a constructed
 * OpenAI-compatible model instance for OpenRouter / self-hosted Hermes.
 */
function resolveHermitModel(): ModelResolution {
  const modelId = asTrimmed(process.env.HERMIT_AGENT_MODEL) || DEFAULT_MODEL
  const provider = asTrimmed(process.env.HERMIT_AGENT_PROVIDER).toLowerCase()
  const explicitBaseUrl = asTrimmed(process.env.HERMIT_AGENT_BASE_URL)

  const useCompatible =
    provider === 'openai-compatible' || provider === 'openrouter' || explicitBaseUrl.length > 0

  if (!useCompatible) {
    // AI Gateway path: the SDK accepts a `provider/model` string directly.
    return { ok: true, model: modelId }
  }

  const apiKey =
    asTrimmed(process.env.HERMIT_AGENT_API_KEY) || asTrimmed(process.env.OPENROUTER_API_KEY)
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'Hermit OpenAI-compatible provider is missing an API key',
    }
  }

  const baseURL = explicitBaseUrl || OPENROUTER_BASE_URL
  const compat = createOpenAICompatible({
    name: 'hermit-agent',
    baseURL,
    apiKey,
    // OpenRouter attribution headers are optional but recommended; harmless for
    // other OpenAI-compatible hosts.
    headers: {
      'HTTP-Referer': 'https://app.4626.fun',
      'X-Title': '4626 Hermit',
    },
  })
  return { ok: true, model: compat(modelId) }
}

function readTimeoutMs(): number {
  const parsed = Number(asTrimmed(process.env.HERMIT_AGENT_DRAFT_TIMEOUT_MS))
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS
  return Math.min(Math.max(Math.floor(parsed), 5_000), 60_000)
}

function readMaxOutputTokens(): number {
  const parsed = Number(asTrimmed(process.env.HERMIT_AGENT_MAX_OUTPUT_TOKENS))
  if (!Number.isFinite(parsed) || parsed <= 0) return MAX_OUTPUT_TOKENS_DEFAULT
  return Math.min(Math.max(Math.floor(parsed), 32), 4_000)
}

function bearerFromRequest(req: VercelRequest): string {
  const header = req.headers.authorization
  const raw = Array.isArray(header) ? header[0] : header
  if (typeof raw !== 'string') return ''
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return match ? match[1].trim() : ''
}

/** Length-aware constant-time-ish comparison for the shared bearer secret. */
function secretsMatch(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Fail closed: never generate without a configured shared secret.
  const expectedBearer = asTrimmed(process.env.HERMIT_AGENT_BEARER_TOKEN)
  if (!expectedBearer) {
    return res.status(503).json({ error: 'Hermit draft endpoint is not configured' })
  }
  if (!secretsMatch(bearerFromRequest(req), expectedBearer)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('hermit-draft', getClientIp(req)),
    RATE_LIMITS.chatCommandPreflight,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ error: 'Too many requests' })
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: MAX_PROMPT_BYTES })
  const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}
  const prompt = asTrimmed((body as { prompt?: unknown }).prompt).slice(0, MAX_PROMPT_CHARS)
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' })
  }

  const resolved = resolveHermitModel()
  if (!resolved.ok) {
    return res.status(resolved.status).json({ error: resolved.error })
  }
  const system = asTrimmed(process.env.HERMIT_AGENT_SYSTEM)

  try {
    const { text } = await generateText({
      model: resolved.model,
      prompt,
      ...(system ? { system } : {}),
      maxOutputTokens: readMaxOutputTokens(),
      temperature: 0.85,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(readTimeoutMs()),
    })
    const reply = asTrimmed(text)
    if (!reply) {
      return res.status(502).json({ error: 'Empty draft from model' })
    }
    return res.status(200).json({ text: reply })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Draft generation failed'
    return res.status(502).json({ error: message.slice(0, 240) })
  }
}
