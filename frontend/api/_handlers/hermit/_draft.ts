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
  logger,
} from '@4626/server-core'

import {
  modelHintRequiresCompatiblePath,
  parseDraftHints,
  resolveDraftMaxOutputTokens,
  resolveDraftTimeoutMs,
  type ParsedDraftHints,
} from '../../../server/_lib/hermit/draftHints.js'

/**
 * Hermit creative brain — first-party replacement for the retired Pinata
 * OpenClaw route.
 *
 * Contract (matches `runPinataDraftOverHttp` in
 * `server/_lib/hermit/skillRouter.ts`): authenticated `POST { prompt, hints? }`,
 * responds with a top-level `{ text }`. The skill router owns persona and
 * room context inside `prompt`; optional `hints` carry per-route policy from
 * `creativePolicy.ts` (model, maxOutputTokens, timeoutMs).
 *
 * Model backend selection:
 *   - Per-request `hints.model` when present, else `HERMIT_AGENT_MODEL`.
 *   - `nousresearch/*` hints (and env-forced compatible mode) use OpenAI-compatible hosts.
 *   - Other provider/model strings use the Vercel AI Gateway path.
 *
 * Auth: shared bearer (`HERMIT_AGENT_BEARER_TOKEN`). Fails closed when unset.
 */

const DEFAULT_MODEL = 'openai/gpt-4.1-mini'
const DEFAULT_TIMEOUT_MS = 12_000
const MAX_PROMPT_BYTES = 24_576
const MAX_PROMPT_CHARS = 8_000
const MAX_OUTPUT_TOKENS_DEFAULT = 400
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const HERMES_OUTPUT_GUARD =
  'Respond with only the final message. Do not include analysis, planning, chain-of-thought, or <think> tags.'

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type ModelResolution =
  | { ok: true; kind: 'gateway' | 'compatible'; model: LanguageModel; modelId: string }
  | { ok: false; status: number; error: string }

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function stripReasoningArtifacts(text: string): string {
  return text
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning\b[^>]*>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<reasoning\b[^>]*>[\s\S]*$/gi, '')
    .replace(/<\/?(?:think|reasoning)\b[^>]*>/gi, '')
    .trim()
}

function classifyModelError(error: unknown): { status: number; message: string } {
  const name = typeof (error as { name?: unknown })?.name === 'string' ? (error as { name: string }).name : ''
  const raw = error instanceof Error ? error.message : 'Draft generation failed'
  if (name === 'TimeoutError' || name === 'AbortError' || /\baborted\b|timed?\s?out/i.test(raw)) {
    return { status: 504, message: 'Draft timed out' }
  }
  const statusCode = Number((error as { statusCode?: unknown })?.statusCode)
  if (statusCode === 429 || /\b429\b|rate[\s-]?limit|too many requests/i.test(raw)) {
    return { status: 429, message: 'Upstream model rate limited' }
  }
  return { status: 502, message: raw.slice(0, 240) }
}

function envForcesCompatiblePath(): boolean {
  const provider = asTrimmed(process.env.HERMIT_AGENT_PROVIDER).toLowerCase()
  const explicitBaseUrl = asTrimmed(process.env.HERMIT_AGENT_BASE_URL)
  return provider === 'openai-compatible' || provider === 'openrouter' || explicitBaseUrl.length > 0
}

function resolveCompatibleModel(modelId: string): ModelResolution {
  const apiKey =
    asTrimmed(process.env.HERMIT_AGENT_API_KEY) || asTrimmed(process.env.OPENROUTER_API_KEY)
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'Hermit OpenAI-compatible provider is missing an API key',
    }
  }

  const baseURL = asTrimmed(process.env.HERMIT_AGENT_BASE_URL) || OPENROUTER_BASE_URL
  if (!isValidHttpUrl(baseURL)) {
    return {
      ok: false,
      status: 503,
      error: 'Hermit OpenAI-compatible base URL is invalid',
    }
  }

  const compat = createOpenAICompatible({
    name: 'hermit-agent',
    baseURL,
    apiKey,
    headers: {
      'HTTP-Referer': 'https://app.4626.fun',
      'X-Title': '4626 Hermit',
    },
  })
  return { ok: true, kind: 'compatible', model: compat(modelId), modelId }
}

/** Exported for contract tests. */
export function resolveHermitModelForDraft(hints: ParsedDraftHints | null): ModelResolution {
  const modelId = asTrimmed(hints?.model) || asTrimmed(process.env.HERMIT_AGENT_MODEL) || DEFAULT_MODEL
  const useCompatible =
    modelHintRequiresCompatiblePath(modelId) || (!hints?.model && envForcesCompatiblePath())

  if (!useCompatible) {
    return { ok: true, kind: 'gateway', model: modelId, modelId }
  }
  return resolveCompatibleModel(modelId)
}

function readEnvTimeoutMs(): number {
  const parsed = Number(asTrimmed(process.env.HERMIT_AGENT_DRAFT_TIMEOUT_MS))
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS
  return Math.min(Math.max(Math.floor(parsed), 5_000), 60_000)
}

function readEnvMaxOutputTokens(): number {
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

  const hints = parseDraftHints(body as Record<string, unknown>)
  const resolved = resolveHermitModelForDraft(hints)
  if (!resolved.ok) {
    return res.status(resolved.status).json({ error: resolved.error })
  }

  const maxOutputTokens = resolveDraftMaxOutputTokens(hints, readEnvMaxOutputTokens())
  const timeoutMs = resolveDraftTimeoutMs(hints, readEnvTimeoutMs())
  const operatorSystem = asTrimmed(process.env.HERMIT_AGENT_SYSTEM)
  const system =
    resolved.kind === 'compatible'
      ? [HERMES_OUTPUT_GUARD, operatorSystem].filter(Boolean).join('\n\n')
      : operatorSystem

  const startedAtMs = Date.now()
  try {
    const { text } = await generateText({
      model: resolved.model,
      prompt,
      ...(system ? { system } : {}),
      maxOutputTokens,
      temperature: 0.85,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    })
    const reply = stripReasoningArtifacts(typeof text === 'string' ? text : '')
    if (!reply) {
      logger.info('[hermit] draft generation completed', {
        route: hints?.route ?? null,
        tier: hints?.tier ?? null,
        modelHint: resolved.modelId,
        maxOutputTokens,
        timeoutMs,
        providerKind: resolved.kind,
        ok: false,
        latencyMs: Date.now() - startedAtMs,
      })
      return res.status(502).json({ error: 'Empty draft from model' })
    }
    logger.info('[hermit] draft generation completed', {
      route: hints?.route ?? null,
      tier: hints?.tier ?? null,
      modelHint: resolved.modelId,
      maxOutputTokens,
      timeoutMs,
      providerKind: resolved.kind,
      ok: true,
      latencyMs: Date.now() - startedAtMs,
    })
    return res.status(200).json({ text: reply })
  } catch (error) {
    const classified = classifyModelError(error)
    logger.info('[hermit] draft generation completed', {
      route: hints?.route ?? null,
      tier: hints?.tier ?? null,
      modelHint: resolved.modelId,
      maxOutputTokens,
      timeoutMs,
      providerKind: resolved.kind,
      ok: false,
      latencyMs: Date.now() - startedAtMs,
      errorStatus: classified.status,
    })
    return res.status(classified.status).json({ error: classified.message })
  }
}
