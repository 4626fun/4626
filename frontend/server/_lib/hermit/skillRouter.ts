/**
 * Hermit / Pinata creative lane — strict architectural boundary.
 *
 * This module owns ONLY creative generation (`/hermit`, `/meme`, `/gmeow`)
 * by delegating to the Pinata-hosted Open Claw / Hermit agent. It must not:
 *
 *   - read or write `alfaclub_runtime_secret` rows (auth state),
 *   - call `chatTokenStore` helpers,
 *   - start or trigger the Privy token refresher.
 *
 * AlfaClub authentication / Privy session refresh is owned by Vercel cron
 * (`/api/v1/alfaclub/chat-token-refresh` → `runAlfaClubPrivyRefreshOnce`)
 * and persisted in Supabase (`alfaclub_runtime_secret`). The chat bridge
 * (`alfaclub/chatBridge.ts`) reads those rows on every tick. Routing into
 * this module happens after the bridge has already authenticated.
 *
 * If you find yourself adding an import from `../alfaclub/chatTokenStore.js`
 * here, stop — that belongs in the auth lane, not the creative lane.
 */
import { pickGmeowLocalLine, pickRandomHermitMeme } from './memeStore.js'
import { formatHermitCommandRoomHelp } from './hermitAlfaClubHelp.js'
import type {
  HermitExecutionParams,
  HermitExecutionResult,
  HermitMediaAttachment,
  HermitPreferenceLister,
  HermitUserPreferences,
} from './types.js'
import WebSocket from 'ws'
import { logger } from '../infra/logger.js'
import { getClearinghouseState } from '../alfaclub/hyperliquid.js'
import { formatRoom1659MarketForHermit } from '../alfaclub/room1659Market.js'
import {
  buildHyperliquidPositionReport,
  formatPositionAlertStatusBlock,
} from '../alfaclub/positionReport.js'
import {
  disableHyperliquidPositionAlert,
  describeHyperliquidAlertDefaults,
  enableDefaultHyperliquidPositionAlert,
  parseHermitAlertCommandArgs,
  readHyperliquidPositionAlert,
  resolveTelegramChatIdForWallet,
  upsertHyperliquidPositionAlert,
} from '../alfaclub/positionAlertStore.js'

declare const process: { env: Record<string, string | undefined> }

type PinataChatResult = {
  text: string
}

type PinataGatewayEvent =
  | { type: 'event'; event?: string; payload?: Record<string, unknown> }
  | { type: 'res'; id?: string; ok?: boolean; payload?: Record<string, unknown>; error?: Record<string, unknown> }

const PINATA_GATEWAY_RPC_TIMEOUT_MS_DEFAULT = 60_000
const PINATA_HTTP_FALLBACK_TIMEOUT_MS_DEFAULT = 30_000

const PINATA_AGENT_FAILURE_PATTERNS = [
  /oauth token refresh failed/i,
  /agent failed before reply/i,
  /failed to load agent model/i,
  /incorrect api key provided/i,
  /no api key found for provider/i,
  /re-authenticate/i,
  /all models failed/i,
] as const

export function isPinataAgentFailureReply(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  return PINATA_AGENT_FAILURE_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function readPinataGatewayTimeoutMs(): number {
  const raw = asTrimmed(process.env.HERMIT_PINATA_GATEWAY_TIMEOUT_MS)
  if (!raw) return PINATA_GATEWAY_RPC_TIMEOUT_MS_DEFAULT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return PINATA_GATEWAY_RPC_TIMEOUT_MS_DEFAULT
  return Math.min(Math.max(Math.floor(parsed), 5_000), 180_000)
}

function readPinataHttpTimeoutMs(): number {
  const raw = asTrimmed(process.env.HERMIT_PINATA_HTTP_TIMEOUT_MS)
  if (!raw) return PINATA_HTTP_FALLBACK_TIMEOUT_MS_DEFAULT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return PINATA_HTTP_FALLBACK_TIMEOUT_MS_DEFAULT
  return Math.min(Math.max(Math.floor(parsed), 1_000), 120_000)
}

type HermitDraftMode = 'copy' | 'announce' | 'quest' | 'tone'

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

const HERMIT_STRICT_JSON_SYSTEM_LINE = 'You are Hermit crafting one short meme line for AlfaChat.'
const HERMIT_STRICT_JSON_OUTPUT_LINE = 'Output STRICT JSON only:'
const HERMIT_STRICT_JSON_SCHEMA_LINE = '{"line":"string"}'
const HERMIT_STRICT_JSON_WEBCHAT_DENY_REGEX =
  /You are Hermit crafting one short meme line for AlfaChat\.[\s\S]*Output STRICT JSON only:[\s\S]*\{"line":"string"\}/m

function isStrictJsonHermitWorkerPrompt(text: string): boolean {
  const body = text.trim()
  if (!body) return false
  return (
    body.includes(HERMIT_STRICT_JSON_SYSTEM_LINE) &&
    body.includes(HERMIT_STRICT_JSON_OUTPUT_LINE) &&
    body.includes(HERMIT_STRICT_JSON_SCHEMA_LINE)
  )
}

function readHermitWebchatHumanIdentity(): string {
  const configured = asTrimmed(process.env.HERMIT_WEBCHAT_HUMAN_IDENTITY).toLowerCase()
  if (configured) return configured
  // Default to the canonical 4626 human identity unless overridden.
  return '0xb05cf01231cf2ff99499682e64d3780d57c80fdd'
}

function readHermitWebchatDenySources(): Set<string> {
  const raw = asTrimmed(process.env.HERMIT_WEBCHAT_DENY_SOURCES)
  const values = (raw ? raw : 'openclaw-control-ui,alfaclub-bridge-runner')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
  return new Set(values)
}

function isHermitSourceDeniedForWebchat(sourceIdentity: string): boolean {
  if (!sourceIdentity) return false
  return readHermitWebchatDenySources().has(sourceIdentity.toLowerCase())
}

function readHermitWorkerSessionKey(): string {
  const value = asTrimmed(process.env.HERMIT_WORKER_SESSION_KEY)
  return value || 'alfaclub-worker'
}

function readHermitWebchatSessionKey(): string {
  const value = asTrimmed(process.env.HERMIT_WEBCHAT_SESSION_KEY)
  return value || 'main'
}

type HermitGatewayRoute = {
  sessionKey: string
  mode: 'webchat' | 'worker'
  deliver: boolean
  sourceIdentity: string
}

/** Pinata OpenClaw gateway `connect` only accepts a subset of client.mode values. */
function resolvePinataGatewayClientMode(routeMode: HermitGatewayRoute['mode']): string {
  if (routeMode === 'webchat') return 'webchat'
  return 'backend'
}

function selectHermitGatewayRoute(params: {
  prompt: string
  sourceIdentity: string
  senderAddress: string
}): HermitGatewayRoute {
  const sourceIdentity = params.sourceIdentity.trim().toLowerCase()
  const isStrictJson = isStrictJsonHermitWorkerPrompt(params.prompt)
  const sourceDenied = isHermitSourceDeniedForWebchat(sourceIdentity)
  const humanIdentity = readHermitWebchatHumanIdentity()
  const isHumanSender = params.senderAddress.trim().toLowerCase() === humanIdentity
  const allowWebchat = isHumanSender && !isStrictJson && !sourceDenied
  if (!allowWebchat) {
    return {
      sessionKey: readHermitWorkerSessionKey(),
      mode: 'worker',
      deliver: false,
      sourceIdentity,
    }
  }
  return {
    sessionKey: readHermitWebchatSessionKey(),
    mode: 'webchat',
    deliver: false,
    sourceIdentity,
  }
}

function isLikelyPinataProviderErrorText(value: string): boolean {
  const text = value.trim().toLowerCase()
  if (!text) return false
  return (
    text.includes('agent failed before reply') ||
    text.includes('oauth token refresh failed') ||
    text.includes('failed to refresh oauth token') ||
    text.includes('openai-codex') ||
    text.includes('logs: openclaw logs')
  )
}

function splitCommandAndArgs(input: string): { command: string; args: string } {
  const trimmed = input.trim()
  if (!trimmed) return { command: '', args: '' }
  const firstSpace = trimmed.indexOf(' ')
  if (firstSpace === -1) return { command: trimmed.toLowerCase(), args: '' }
  return {
    command: trimmed.slice(0, firstSpace).toLowerCase(),
    args: trimmed.slice(firstSpace + 1).trim(),
  }
}

function parseHermitDraftMode(args: string): { mode: HermitDraftMode; prompt: string } {
  const trimmed = args.trim()
  if (!trimmed) {
    return { mode: 'copy', prompt: 'short hype line for a room post' }
  }
  const firstSpace = trimmed.indexOf(' ')
  const token = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase()
  const rest = (firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1)).trim()
  if (token === 'copy' || token === 'announce' || token === 'quest' || token === 'tone') {
    return {
      mode: token,
      prompt: rest || 'short hype line for a room post',
    }
  }
  return { mode: 'copy', prompt: trimmed }
}

function trimList(values: string[], max = 6): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max)
}

function parseLooseJsonObject(text: string): Record<string, unknown> | null {
  const raw = text.trim()
  if (!raw) return null
  const direct = raw.match(/\{[\s\S]*\}/)
  if (!direct) return null
  try {
    const parsed = JSON.parse(direct[0]) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return []
  return trimList(
    value.filter((entry): entry is string => typeof entry === 'string'),
    max,
  )
}

/**
 * Resolve a recognised image extension for an HTTPS URL by checking
 * the path's tail segment first, and — when the path itself has no
 * recognised suffix — the `?filename=` query parameter. The query
 * fallback covers gateway URLs such as
 * `https://4626.fun/ipfs/<cid>?filename=catlaugh.gif`, where the path
 * is just the CID and the readable name lives in the query string.
 *
 * Validation is deliberately narrow:
 *   - HTTPS only (caller pre-checks).
 *   - Allowed extensions: gif, jpg, jpeg, png, webp.
 *   - The `filename` query value must itself end in one of those
 *     extensions; we never trust the value beyond inferring the
 *     extension. Anything else (e.g. `?filename=evil.html` or a stray
 *     attribute) yields `null`.
 *
 * Returns the canonical extension (lowercase, no dot) plus a clean
 * filename when one can be derived from path or query, or `null`
 * when the URL is not a recognised inline-image candidate.
 */
type InferredImageExtension = 'gif' | 'jpg' | 'jpeg' | 'png' | 'webp'
const RECOGNISED_IMAGE_EXTS: ReadonlySet<InferredImageExtension> = new Set([
  'gif',
  'jpg',
  'jpeg',
  'png',
  'webp',
])

const DEFAULT_HERMIT_MEDIA_ALLOWED_HOST_PATTERNS: readonly string[] = [
  'media.tenor.com',
  'i.giphy.com',
  'media.giphy.com',
  '4626.fun',
  'pinata.4626.fun',
  '*.mypinata.cloud',
  'ipfs.decentralized-content.com',
  'pbs.twimg.com',
  // RFC 2606 reserved domain used in unit tests.
  '*.example.com',
  '*.example',
  'example',
]

function pickImageExtension(name: string): InferredImageExtension | null {
  const dot = name.lastIndexOf('.')
  if (dot < 0 || dot === name.length - 1) return null
  const ext = name.slice(dot + 1)
  return RECOGNISED_IMAGE_EXTS.has(ext as InferredImageExtension)
    ? (ext as InferredImageExtension)
    : null
}

function resolveImageNameAndExt(
  pathname: string,
  hintedFilename: string,
): { filename: string; extension: InferredImageExtension } | null {
  // Try the path's tail segment first — that's the primary case for
  // direct CDN URLs like `…/cat.gif` or `…/photo.jpg`.
  const pathTail = pathname.split('/').filter(Boolean).pop() ?? ''
  const pathExt = pickImageExtension(pathTail)
  if (pathExt) {
    return { filename: pathTail, extension: pathExt }
  }
  // Fall back to the `?filename=` hint for gateway-style URLs where the
  // path is just an opaque CID. Still require the hint itself to end in
  // a recognised image extension — we never trust the query value
  // beyond extension inference.
  if (hintedFilename) {
    const hintedExt = pickImageExtension(hintedFilename)
    if (hintedExt) {
      return { filename: hintedFilename, extension: hintedExt }
    }
  }
  return null
}

function readHermitMediaAllowedHostPatterns(): string[] {
  const raw = asTrimmed(process.env.HERMIT_MEDIA_ALLOWED_HOSTS)
  if (!raw) return [...DEFAULT_HERMIT_MEDIA_ALLOWED_HOST_PATTERNS]
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function hostMatchesAllowedPattern(hostname: string, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2)
    if (!suffix) return false
    return hostname === suffix || hostname.endsWith(`.${suffix}`)
  }
  return hostname === pattern
}

function isHermitMediaHostAllowed(hostname: string): boolean {
  const patterns = readHermitMediaAllowedHostPatterns()
  if (patterns.length === 0) return false
  return patterns.some((pattern) => hostMatchesAllowedPattern(hostname, pattern))
}

const IMAGE_EXTENSION_MIME_TYPE: Record<InferredImageExtension, string> = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function inferPublicMediaAttachment(url: string): HermitMediaAttachment | null {
  const trimmed = url.trim()
  if (!/^https:\/\//i.test(trimmed)) return null
  let pathname = ''
  let hostname = ''
  let hintedFilename = ''
  try {
    const parsed = new URL(trimmed)
    pathname = parsed.pathname.toLowerCase()
    hostname = parsed.hostname.toLowerCase()
    hintedFilename = (parsed.searchParams.get('filename') ?? '').toLowerCase()
  } catch {
    return null
  }

  const resolved = resolveImageNameAndExt(pathname, hintedFilename)
  if (!resolved) return null
  if (!isHermitMediaHostAllowed(hostname)) return null
  const { filename, extension } = resolved

  // Tenor's `media.tenor.com` GIFs are a known special case in
  // production: the AlfaClub client renders them with `type:
  // 'tenor-gif'` and no `mime_type`. Preserve that exact shape so the
  // existing client-side renderer keeps working unchanged.
  if (hostname === 'media.tenor.com' && extension === 'gif') {
    return { url: trimmed, type: 'tenor-gif' }
  }

  // For every other recognised image extension — including non-Tenor
  // GIFs — emit the generic `photo` shape with an explicit MIME type.
  // AlfaClub renders these inline based on `type` + `mime_type`.
  return {
    url: trimmed,
    type: 'photo',
    ...(filename ? { filename } : {}),
    mime_type: IMAGE_EXTENSION_MIME_TYPE[extension],
  }
}

function readPinataHermitConfig(): { endpoint: string; bearer: string } | null {
  const endpoint = asTrimmed(process.env.HERMIT_PINATA_CHAT_ENDPOINT)
  const bearer = asTrimmed(process.env.HERMIT_PINATA_BEARER_TOKEN)
  if (!endpoint || !bearer) return null
  return { endpoint, bearer }
}

/**
 * Whether /gmeow should call Pinata for an extra caption line.
 *
 * Default (env unset): Pinata one-liner when configured; else local hooks + rotating GIFs.
 * - `HERMIT_GMEOW_PINATA_CAPTION=always` — call Pinata on every /gmeow when configured.
 * - `HERMIT_GMEOW_PINATA_CAPTION=prompt` — call Pinata only when the user adds text after /gmeow.
 * - `HERMIT_GMEOW_PINATA_CAPTION=0` — never call Pinata for /gmeow (local hooks only).
 * - `HERMIT_GMEOW_PINATA_CAPTION=local` — force local hooks even when Pinata is configured.
 */
export function shouldRequestPinataGmeowCaption(userPromptAfterCommand: string): boolean {
  const mode = asTrimmed(process.env.HERMIT_GMEOW_PINATA_CAPTION).toLowerCase()
  if (mode === '0' || mode === 'false' || mode === 'no' || mode === 'off' || mode === 'never') {
    return false
  }
  if (mode === 'local' || mode === 'offline') {
    return false
  }
  if (
    mode === '1' ||
    mode === 'true' ||
    mode === 'yes' ||
    mode === 'on' ||
    mode === 'always' ||
    mode === 'all' ||
    mode === 'legacy'
  ) {
    return true
  }
  if (mode === 'prompt' || mode === 'args' || mode === 'text') {
    return userPromptAfterCommand.trim().length > 0
  }
  // Env unset: creative Pinata line when endpoint is configured (caller still gates on config).
  return true
}

function toGatewaySocketUrl(rawEndpoint: string): { wsUrl: string; origin: string } | null {
  let parsed: URL
  try {
    parsed = new URL(rawEndpoint)
  } catch {
    return null
  }

  const host = parsed.hostname.toLowerCase()
  const isPinataGatewayHost =
    host.endsWith('.agents.pinata.cloud') || host.endsWith('.apps.pinata.cloud')
  if (!isPinataGatewayHost) return null

  const wsProtocol = parsed.protocol === 'https:' || parsed.protocol === 'wss:' ? 'wss:' : 'ws:'
  const originProtocol = parsed.protocol === 'wss:' ? 'https:' : parsed.protocol === 'ws:' ? 'http:' : parsed.protocol
  const wsUrl = `${wsProtocol}//${parsed.host}${parsed.pathname || '/'}`
  const origin = `${originProtocol}//${parsed.host}`
  return { wsUrl, origin }
}

function toPinataHttpChatUrl(rawEndpoint: string): string {
  const gateway = toGatewaySocketUrl(rawEndpoint)
  if (!gateway) return rawEndpoint
  try {
    const parsed = new URL(rawEndpoint)
    const httpProtocol =
      parsed.protocol === 'wss:' ? 'https:' : parsed.protocol === 'ws:' ? 'http:' : parsed.protocol
    const path = !parsed.pathname || parsed.pathname === '/' ? '' : parsed.pathname
    return `${httpProtocol}//${parsed.host}${path}`
  } catch {
    return rawEndpoint
  }
}

function readPinataBridgeHttpOnlyDisabled(): boolean {
  const raw = asTrimmed(process.env.HERMIT_PINATA_BRIDGE_HTTP_ONLY).toLowerCase()
  return raw === '0' || raw === 'false' || raw === 'no' || raw === 'off'
}

function readPinataBridgeHttpOnlyEnabled(): boolean {
  const raw = asTrimmed(process.env.HERMIT_PINATA_BRIDGE_HTTP_ONLY).toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

/** Pinata-hosted OpenClaw agents only expose creative draft over gateway WS — root HTTPS POST 404s. */
export function pinataEndpointSupportsHttpDraft(rawEndpoint: string | undefined): boolean {
  const endpoint = asTrimmed(rawEndpoint)
  if (!endpoint) return false
  return toGatewaySocketUrl(endpoint) === null
}

/**
 * AlfaClub bridge calls Pinata for generation only — Vercel posts the
 * formatted reply. OpenClaw gateway `chat.send` on a Pinata agent that
 * also has an AlfaClub channel/skill mirrors the full worker prompt and
 * raw JSON assistant output into the live room as duplicate "4626" /
 * "Agent Hermit" messages. Prefer the stateless HTTP draft path for
 * bridge-initiated strict-JSON creative calls when the endpoint exposes
 * one; Pinata `.agents.pinata.cloud` hosts use gateway WS only.
 */
export function shouldPreferPinataHttpDraft(params: {
  sourceIdentity?: string | null
  prompt: string
  endpoint?: string | null
}): boolean {
  const endpoint = asTrimmed(params.endpoint) || asTrimmed(process.env.HERMIT_PINATA_CHAT_ENDPOINT)
  if (!pinataEndpointSupportsHttpDraft(endpoint)) return false
  if (readPinataBridgeHttpOnlyEnabled()) return true
  const source = asTrimmed(params.sourceIdentity).toLowerCase()
  if (source === 'alfaclub-bridge-runner') {
    return !readPinataBridgeHttpOnlyDisabled()
  }
  return isStrictJsonHermitWorkerPrompt(params.prompt)
}

function extractChatFinalText(payload: Record<string, unknown> | undefined): string | null {
  if (!payload) return null
  const state = typeof payload.state === 'string' ? payload.state : ''
  if (state !== 'final') return null
  const message = payload.message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return null
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return null
  const textParts = content
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return ''
      const text = (entry as { text?: unknown }).text
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
  const joined = textParts.join('').trim()
  if (!joined) return null
  if (isPinataAgentFailureReply(joined)) return null
  return joined
}

async function runPinataDraftOverGateway(params: {
  endpoint: string
  bearer: string
  prompt: string
  senderAddress?: string
  sourceIdentity?: string | null
}): Promise<PinataChatResult | null> {
  const gateway = toGatewaySocketUrl(params.endpoint)
  if (!gateway) return null
  const route = selectHermitGatewayRoute({
    prompt: params.prompt,
    sourceIdentity: asTrimmed(params.sourceIdentity),
    senderAddress: asTrimmed(params.senderAddress),
  })

  return await new Promise<PinataChatResult | null>((resolve) => {
    const socket = new WebSocket(gateway.wsUrl, {
      headers: {
        Authorization: `Bearer ${params.bearer}`,
        Origin: gateway.origin,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })

    let settled = false
    let connectSent = false
    let connected = false
    let runId: string | null = null

    const finish = (result: PinataChatResult | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      try {
        socket.close()
      } catch {}
      resolve(result)
    }

    const sendReq = (id: string, method: string, payload: Record<string, unknown>): void => {
      socket.send(
        JSON.stringify({
          type: 'req',
          id,
          method,
          params: payload,
        }),
      )
    }

    const sendConnect = (): void => {
      if (settled || connectSent) return
      connectSent = true
      sendReq('connect-1', 'connect', {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'openclaw-control-ui',
          version: 'control-ui',
          platform: 'node',
          mode: resolvePinataGatewayClientMode(route.mode),
          instanceId: `hermit-${Date.now()}`,
        },
        role: 'operator',
        scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
        caps: ['tool-events'],
        auth: { token: params.bearer },
        userAgent: 'Mozilla/5.0',
        locale: 'en-US',
      })
    }

    const timeout = setTimeout(() => finish(null), readPinataGatewayTimeoutMs())

    socket.on('open', () => {
      setTimeout(() => sendConnect(), 300)
    })

    socket.on('message', (raw) => {
      if (settled) return
      let msg: PinataGatewayEvent
      try {
        msg = JSON.parse(String(raw)) as PinataGatewayEvent
      } catch {
        return
      }

      if (msg.type === 'event') {
        if (msg.event === 'connect.challenge') {
          sendConnect()
          return
        }
        if (msg.event === 'chat') {
          const payload = msg.payload
          if (!payload || typeof payload !== 'object') return
          if (runId && (payload as { runId?: unknown }).runId !== runId) return
          const text = extractChatFinalText(payload)
          if (text) finish({ text })
          return
        }
        return
      }

      if (msg.type !== 'res') return
      if (msg.id === 'connect-1') {
        if (!msg.ok) {
          finish(null)
          return
        }
        connected = true
        const nextRunId = `hermit-${Date.now()}`
        runId = nextRunId
        sendReq('chat-send-1', 'chat.send', {
          sessionKey: route.sessionKey,
          message: params.prompt,
          deliver: route.deliver,
          idempotencyKey: nextRunId,
        })
        return
      }

      if (!connected) return
      if (msg.id === 'chat-send-1') {
        if (!msg.ok) {
          finish(null)
          return
        }
        const payload = msg.payload
        runId =
          payload && typeof payload === 'object' && typeof payload.runId === 'string'
            ? payload.runId
            : null
        return
      }
    })

    socket.on('close', () => finish(null))
    socket.on('error', () => finish(null))
  })
}

async function runPinataDraftOverHttp(params: {
  endpoint: string
  bearer: string
  prompt: string
}): Promise<PinataChatResult | null> {
  // Bound by `HERMIT_PINATA_HTTP_TIMEOUT_MS` so a hung creative backend
  // cannot stall the AlfaClub chat-bridge tick or leave a /hermit
  // serverless invocation running until Vercel kills it.
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), readPinataHttpTimeoutMs())
  let res: Response
  try {
    res = await fetch(toPinataHttpChatUrl(params.endpoint), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: params.prompt }),
      signal: controller.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timeoutHandle)
  }
  if (!res.ok) return null

  try {
    const body = (await res.json()) as Record<string, unknown>
    const text =
      asTrimmed(body.text) ||
      asTrimmed(body.response) ||
      asTrimmed(body.output) ||
      asTrimmed(body.message)
    return text ? { text } : null
  } catch {
    return null
  }
}

async function runPinataDraft(params: {
  prompt: string
  senderAddress?: string
  sourceIdentity?: string | null
}): Promise<PinataChatResult | null> {
  const cfg = readPinataHermitConfig()
  if (!cfg) return null

  const preferHttp = shouldPreferPinataHttpDraft({
    sourceIdentity: params.sourceIdentity,
    prompt: params.prompt,
    endpoint: cfg.endpoint,
  })
  if (preferHttp) {
    const viaHttp = await runPinataDraftOverHttp({
      endpoint: cfg.endpoint,
      bearer: cfg.bearer,
      prompt: params.prompt,
    })
    if (viaHttp?.text) return viaHttp
    logger.warn('[hermit] bridge_http_draft_empty; falling_back_to_gateway', {
      sourceIdentity: asTrimmed(params.sourceIdentity) || 'none',
      promptHead: params.prompt.slice(0, 64),
    })
  }

  const gatewayTarget = toGatewaySocketUrl(cfg.endpoint)
  if (gatewayTarget) {
    const route = selectHermitGatewayRoute({
      prompt: params.prompt,
      sourceIdentity: asTrimmed(params.sourceIdentity),
      senderAddress: asTrimmed(params.senderAddress),
    })
    if (route.mode === 'webchat' && HERMIT_STRICT_JSON_WEBCHAT_DENY_REGEX.test(params.prompt)) {
      logger.warn('[hermit] dropped_webchat_strict_json_prompt', {
        sourceIdentity: route.sourceIdentity || 'none',
        sessionKey: route.sessionKey,
      })
      return null
    }
    const viaGateway = await runPinataDraftOverGateway({
      endpoint: cfg.endpoint,
      bearer: cfg.bearer,
      prompt: params.prompt,
      senderAddress: params.senderAddress,
      sourceIdentity: params.sourceIdentity,
    })
    return viaGateway?.text ? viaGateway : null
  }

  return runPinataDraftOverHttp({
    endpoint: cfg.endpoint,
    bearer: cfg.bearer,
    prompt: params.prompt,
  })
}

export type SpanishDialect =
  | 'neutral_latam'
  | 'mexico'
  | 'argentina'
  | 'colombia'
  | 'chile'
  | 'peru'
  | 'venezuela'
  | 'caribbean'
  | 'spain'

const SPANISH_DIALECT_VALUES: ReadonlySet<SpanishDialect> = new Set<SpanishDialect>([
  'neutral_latam',
  'mexico',
  'argentina',
  'colombia',
  'chile',
  'peru',
  'venezuela',
  'caribbean',
  'spain',
])

/**
 * Validate and narrow a string into a known SpanishDialect, or return
 * null. Used to whitelist values coming back from the per-user
 * preference store before they reach prompt-building.
 */
export function asSpanishDialect(value: unknown): SpanishDialect | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  // Accept legacy alias `puerto_rico` for `caribbean`.
  if (normalized === 'puerto_rico') return 'caribbean'
  return SPANISH_DIALECT_VALUES.has(normalized as SpanishDialect)
    ? (normalized as SpanishDialect)
    : null
}

const SPANISH_DIALECT_FLAG_MAP: Record<string, SpanishDialect> = {
  '🇲🇽': 'mexico',
  '🇦🇷': 'argentina',
  '🇨🇴': 'colombia',
  '🇨🇱': 'chile',
  '🇵🇪': 'peru',
  '🇻🇪': 'venezuela',
  '🇵🇷': 'caribbean',
  '🇪🇸': 'spain',
  '🌎': 'neutral_latam',
  '🇺🇳': 'neutral_latam',
}

const SPANISH_DIALECT_TEXT_HINTS: Array<{ pattern: RegExp; dialect: SpanishDialect }> = [
  { pattern: /\bmexicano?s?\b|\bmexicana?s?\b|\bméxico\b|\bmexico\b/i, dialect: 'mexico' },
  { pattern: /\bargentino?s?\b|\bargentina?s?\b|\brioplatense\b/i, dialect: 'argentina' },
  { pattern: /\bcolombiano?s?\b|\bcolombiana?s?\b|\bcolombia\b/i, dialect: 'colombia' },
  { pattern: /\bchileno?s?\b|\bchilena?s?\b|\bchile\b/i, dialect: 'chile' },
  { pattern: /\bperuano?s?\b|\bperuana?s?\b|\bperú\b|\bperu\b/i, dialect: 'peru' },
  { pattern: /\bvenezolano?s?\b|\bvenezolana?s?\b|\bvenezuela\b/i, dialect: 'venezuela' },
  {
    pattern: /\bpuertorriqueñ[oa]s?\b|\bcaribeñ[oa]s?\b|\bpuerto rico\b|\bcaribe\b|\bboricua\b/i,
    dialect: 'caribbean',
  },
  {
    pattern: /\bespañol de españa\b|\bcastellano\b|\bespañol peninsular\b|\bespaña\b/i,
    dialect: 'spain',
  },
  { pattern: /\bneutral latam\b|\blatam neutral\b|\bespañol neutro\b|\bneutro latam\b/i, dialect: 'neutral_latam' },
]

const SPANISH_DIALECT_PROFILES: Record<SpanishDialect, string> = {
  neutral_latam:
    'Neutral Latin American Spanish. Address reader as tú. No regionalisms, no Castilian vosotros.',
  mexico:
    'Mexican Spanish flavor (subtle): tú; sparingly use natural connectors like "ya", "órale", "neta" only when they fit; avoid caricature ("padrísimo", "wey" overused).',
  argentina:
    'Rioplatense / Argentine Spanish (subtle): voseo (vos / tenés / sos); sparingly use "che", "dale"; do not overload with lunfardo; avoid caricature.',
  colombia:
    'Colombian Spanish (subtle): tú or usted neutral; warm and clear; sparingly natural words like "parce", "bacano" only if they fit; avoid caricature.',
  chile:
    'Chilean Spanish (subtle): tú; light natural words like "bacán", "altiro", "po" used sparingly; avoid heavy chilenismos and caricature.',
  peru:
    'Peruvian Spanish (subtle): tú; clear and even register; sparing use of "chévere", "pe" only if natural; avoid caricature.',
  venezuela:
    'Venezuelan Spanish (subtle): tú; warm tone; sparing use of "chévere", "pana" only if natural; avoid caricature.',
  caribbean:
    'Caribbean / Puerto Rican Spanish (subtle): tú; warm and rhythmic; sparing use of "brutal", "wepa" only if natural; avoid caricature and heavy code-switching unless the user does.',
  spain:
    'European (Castilian) Spanish: tú in casual register (vosotros only if user uses it); use peninsular forms ("vale", "guay") sparingly; "coger" is fine; avoid Latin American regionalisms.',
}

function detectSpanishDialect(userInput: string): SpanishDialect | null {
  if (!userInput) return null
  for (const flag of Object.keys(SPANISH_DIALECT_FLAG_MAP)) {
    if (userInput.includes(flag)) return SPANISH_DIALECT_FLAG_MAP[flag]
  }
  for (const { pattern, dialect } of SPANISH_DIALECT_TEXT_HINTS) {
    if (pattern.test(userInput)) return dialect
  }
  return null
}

/**
 * Memory persistence clause.
 *
 * Per-user dialect persistence now lives in the AlfaClub control-plane
 * preference store keyed by (room_id, sender_address) — not in the
 * shared workspace MEMORY.md file (which would leak one user's dialect
 * to every other user in the room).
 *
 * The clause therefore tells Hermit explicitly NOT to mutate MEMORY.md
 * this turn (it has nothing to record there); the bridge persists the
 * explicit signal via `persistPreference` after detecting it.
 *
 * `source` describes how the active dialect was selected so Hermit can
 * weight regional flavor accordingly:
 *   - 'explicit': flag/text hint in this user's message — strong signal.
 *   - 'persisted': loaded from this user's saved preference.
 *   - 'default': no signal, use neutral_latam.
 */
function buildSpanishMemoryPersistenceClause(
  dialect: SpanishDialect | null,
  source: 'explicit' | 'persisted' | 'default',
): string {
  if (source === 'explicit' && dialect !== null) {
    return [
      `Memory persistence (explicit signal): the user just signaled the "${dialect}" Spanish dialect this turn (flag emoji or text hint). The control plane will save that preference for THIS sender only after this reply — you do not need to and MUST NOT modify workspace MEMORY.md (the shared MEMORY.md is room-wide and would leak this user's choice to everyone). Just produce the strict JSON output in the requested dialect.`,
    ].join('\n')
  }
  if (source === 'persisted' && dialect !== null) {
    return [
      `Memory persistence (saved preference): this sender previously chose the "${dialect}" Spanish dialect; the control plane already loaded it for this turn. Apply the matching profile (≈80% clear Spanish / 20% regional flavor, never caricature). Do NOT modify workspace MEMORY.md — per-user preferences live in the AlfaClub control plane, not in the shared MEMORY.md file.`,
    ].join('\n')
  }
  return [
    'Memory persistence: no per-user dialect signal this turn. If you are about to reply in Spanish, default to neutral_latam. Do NOT modify workspace MEMORY.md — per-user dialect preferences live in the AlfaClub control plane (per (room, sender)), not in the shared MEMORY.md file.',
  ].join('\n')
}

function buildHermitLanguageDirective(
  dialect: SpanishDialect | null,
  source: 'explicit' | 'persisted' | 'default' = dialect === null ? 'default' : 'explicit',
): string {
  const effectiveDialect: SpanishDialect = dialect ?? 'neutral_latam'
  const profile = SPANISH_DIALECT_PROFILES[effectiveDialect]
  const dialectClause =
    source === 'explicit' && dialect !== null
      ? `The user signaled the "${effectiveDialect}" dialect this turn (via flag emoji or text hint). When the language rule selects Spanish, write string values in that dialect. Profile: ${profile} Keep flavor subtle — about 80% clear Spanish, 20% regional flavor. Never lean into caricature or stereotypes.`
      : source === 'persisted' && dialect !== null
        ? `This sender's saved preference is the "${effectiveDialect}" dialect. When the language rule selects Spanish, write string values in that dialect. Profile: ${profile} Keep flavor subtle — about 80% clear Spanish, 20% regional flavor. Never lean into caricature or stereotypes.`
        : `Default Spanish dialect is "neutral_latam" — no signal this turn. Profile: ${profile}`
  return [
    'Language: detect the language of the user input. If the user writes in Spanish or explicitly asks for output en español / in Spanish, set string values in natural Latin American Spanish (see workspace SPANISH.md for the style guide; keep crypto-native loanwords like vault, mint, drop, alpha, gm, gas untranslated; address the reader as tú; avoid Castilian forms unless the selected dialect is "spain"). Otherwise reply in English.',
    `Spanish dialect: ${effectiveDialect}. ${dialectClause}`,
    buildSpanishMemoryPersistenceClause(dialect, source),
    'JSON keys always remain exactly as specified in this prompt — keys are English regardless of language. Hashtags stay as-is. Never wrap the JSON in markdown fences. The final assistant message MUST be ONLY the strict JSON object.',
  ].join('\n')
}

const HERMIT_LANGUAGE_DIRECTIVE = buildHermitLanguageDirective(null, 'default')

type DialectResolution = {
  dialect: SpanishDialect | null
  source: 'explicit' | 'persisted' | 'default'
}

/**
 * Priority chain for the active dialect on a Hermit turn:
 *   1. Explicit flag/text hint in the current user message — also
 *      triggers a control-plane upsert so future turns honor it.
 *   2. Persisted user preference from `userPreferences.spanishDialect`.
 *   3. Default → null (caller treats as neutral_latam).
 *
 * Room-level defaults are intentionally NOT mixed in here — if a room
 * default is ever needed, the bridge resolves it before calling Hermit
 * and passes it through `userPreferences`.
 */
function resolveActiveDialect(params: {
  userPrompt: string
  userPreferences?: HermitUserPreferences | null
}): DialectResolution {
  const explicit = detectSpanishDialect(params.userPrompt)
  if (explicit !== null) return { dialect: explicit, source: 'explicit' }
  const persisted = asSpanishDialect(params.userPreferences?.spanishDialect ?? null)
  if (persisted !== null) return { dialect: persisted, source: 'persisted' }
  return { dialect: null, source: 'default' }
}

export function buildPinataPromptForHermit(params: {
  mode: HermitDraftMode
  userPrompt: string
  userPreferences?: HermitUserPreferences | null
  // Room 1659 market data (only present when called from room 1659)
  room1659Market?: any
}): string {
  const modeInstruction =
    params.mode === 'announce'
      ? 'Write an announcement style message for a tokenized community room.'
      : params.mode === 'quest'
        ? 'Write quest/reward drop copy with urgency and clear CTA.'
        : params.mode === 'tone'
          ? 'Rewrite input copy into a sharper social tone while preserving meaning.'
          : 'Write concise room copy with social-native energy.'
  const { dialect, source } = resolveActiveDialect({
    userPrompt: params.userPrompt,
    userPreferences: params.userPreferences,
  })
  const tone = asHermitTone(params.userPreferences?.tone ?? null)
  const toneClause = buildHermitToneClause(tone)

  let marketContext = ''
  if (params.room1659Market && params.room1659Market.ok !== false) {
    const m = params.room1659Market

    const lines = [
      '',
      '=== ROOM 1659 LIVE MARKET CONTEXT (use this for theatrical, dramatic, marketing copy) ===',
      `Current hype score: ${m.hype ?? 'unknown'}`,
      `Current liquidation level: ${m.liquidation ?? 'unknown'}`,
    ]

    const formatted = formatRoom1659MarketForHermit(m)
    lines.push(formatted.yourPosition)

    lines.push('')
    lines.push('INSTRUCTION FOR HERMIT: This room is stressed and theatrical. Turn the numbers above (especially the quadratic curve acceleration, low supply, and liquidation tension) into unhinged, quotable, cinematic, memeable lines. Be dramatic. Be memorable. The "Do not be overly dramatic" rule is suspended for room 1659.')
    marketContext = lines.join('\n')
  }

  return [
    'You are Hermit, a crypto-native creative assistant for AlfaChat communities.',
    modeInstruction,
    'Output STRICT JSON only (no markdown):',
    '{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}',
    'Rules: line <= 220 chars, alt 2-4 entries, hashtags 1-5, no fabricated claims.',
    buildHermitLanguageDirective(dialect, source),
    ...(toneClause ? [toneClause] : []),
    marketContext,
    `User input: ${params.userPrompt}`,
  ].join('\n')
}

function buildHermitHelpReply(roomId?: string | null): string {
  if (roomId) return formatHermitCommandRoomHelp(roomId)
  return [
    'Hermit drafts room-ready copy.',
    '',
    'Use:',
    '- `/hermit copy <idea>` — short post, CTA, and alternates',
    '- `/hermit announce <news>` — announcement-style room update',
    '- `/hermit quest <reward/task>` — quest or reward drop copy',
    '- `/hermit tone <message>` — rewrite your message with sharper social tone',
    '',
    'Examples:',
    '- `/hermit announce reward drop opens in 30 minutes`',
    '- `/hermit quest best vault thesis wins custom role`',
    '- `/hermit tone make this clearer: we are shipping tonight`',
    '',
    'In an AlfaClub Hermit room, `/help` lists the full catalog.',
  ].join('\n')
}

function buildPinataPromptForHermitImage(
  userPrompt: string,
  userPreferences?: HermitUserPreferences | null,
): string {
  const { dialect, source } = resolveActiveDialect({ userPrompt, userPreferences })
  const tone = asHermitTone(userPreferences?.tone ?? null)
  const toneClause = buildHermitToneClause(tone)
  return [
    'You are Hermit, generating meme-ready image concepts for AlfaChat.',
    'Output STRICT JSON only:',
    '{"imagePrompt":"string","caption":"string","hashtags":["#tag"],"imageUrl":"string|null"}',
    'Rules: imagePrompt vivid and specific, caption <= 180 chars, hashtags 1-5, no markdown.',
    'imageUrl is OPTIONAL. Set it ONLY when you can return a public HTTPS URL ending in .gif, .jpg, .jpeg, .png, or .webp (or an HTTPS gateway URL with `?filename=<name>.<ext>` carrying one of those extensions). Otherwise set it to null. Never invent a URL; never return a non-image URL.',
    buildHermitLanguageDirective(dialect, source),
    ...(toneClause ? [toneClause] : []),
    `User input: ${userPrompt || 'akita doge and a black cat in dark-luxury meme style'}`,
  ].join('\n')
}

function buildPinataPromptForGmeow(params: {
  userPrompt: string
  memeCaption: string
  memeTags: string[]
  userPreferences?: HermitUserPreferences | null
}): string {
  const { dialect, source } = resolveActiveDialect({
    userPrompt: params.userPrompt,
    userPreferences: params.userPreferences,
  })
  const tone = asHermitTone(params.userPreferences?.tone ?? null)
  const toneClause = buildHermitToneClause(tone)
  return [
    'You are Hermit crafting one short meme line for AlfaChat.',
    'Output STRICT JSON only:',
    '{"line":"string"}',
    'Rules: line <= 160 chars, playful but clean, no markdown.',
    'Do not repeat the reference caption verbatim — invent a fresh one-liner that fits the GIF vibe.',
    buildHermitLanguageDirective(dialect, source),
    ...(toneClause ? [toneClause] : []),
    `Reference caption: ${params.memeCaption}`,
    `Reference tags: ${params.memeTags.join(', ') || 'meme'}`,
    `User input: ${params.userPrompt || 'gmeow'}`,
  ].join('\n')
}

function formatHermitReplyFromDraft(rawText: string): string {
  const parsed = parseLooseJsonObject(rawText)
  if (!parsed) return rawText.trim()
  const line = asString(parsed.line)
  const alt = asStringArray(parsed.alt, 4)
  const hashtags = asStringArray(parsed.hashtags, 5)
  const cta = asString(parsed.cta)

  const chunks: string[] = []
  if (line) chunks.push(line)
  if (cta) chunks.push(`CTA: ${cta}`)
  if (hashtags.length > 0) chunks.push(hashtags.join(' '))
  if (alt.length > 0) {
    chunks.push(`Alts: ${alt.join(' | ')}`)
  }
  return chunks.join('\n').trim() || rawText.trim()
}

/**
 * Walks a parsed Pinata image-mode response and returns the first
 * URL-shaped value worth attempting to attach. Looked-at fields, in
 * order:
 *   - top-level: `imageUrl`, `image_url`, `url`
 *   - first entry of any of: `attachments`, `media`, `images`
 *     (each entry may itself be a string URL or an object with one of
 *     the URL fields above).
 * Non-string and empty values are skipped silently. The caller is
 * responsible for validating the URL through `inferPublicMediaAttachment`
 * — this function never trusts the value beyond extracting it.
 */
function pickCandidateImageUrl(parsed: Record<string, unknown>): string | null {
  const direct = asString(parsed.imageUrl) || asString(parsed.image_url) || asString(parsed.url)
  if (direct) return direct

  const arrayKeys: ReadonlyArray<keyof typeof parsed> = ['attachments', 'media', 'images']
  for (const key of arrayKeys) {
    const value = parsed[key as string]
    if (!Array.isArray(value)) continue
    for (const entry of value) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim()
        if (trimmed) return trimmed
        continue
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const obj = entry as Record<string, unknown>
        const nested = asString(obj.url) || asString(obj.imageUrl) || asString(obj.image_url)
        if (nested) return nested
      }
    }
  }
  return null
}

function formatHermitImageResult(rawText: string): {
  imagePrompt: string
  reply: string
  mediaAttachments: HermitMediaAttachment[]
} {
  const parsed = parseLooseJsonObject(rawText)
  if (!parsed) {
    const fallback = rawText.trim()
    return { imagePrompt: fallback, reply: fallback, mediaAttachments: [] }
  }
  const imagePrompt = asString(parsed.imagePrompt)
  const caption = asString(parsed.caption)
  const hashtags = asStringArray(parsed.hashtags, 5)

  const replyParts: string[] = []
  if (imagePrompt) replyParts.push(`Prompt: ${imagePrompt}`)
  if (caption) replyParts.push(`Caption: ${caption}`)
  if (hashtags.length > 0) replyParts.push(hashtags.join(' '))

  // Best-effort image attachment. The creative provider MAY return a
  // public HTTPS URL via any of the documented field names; we run
  // each candidate through the PR-#481 validator and attach only the
  // first match. Anything else (http://, data:, .svg, .html, malformed
  // URLs, no field at all) is dropped silently and we fall back to
  // the existing text-only reply — no error, no caller-visible
  // change.
  const mediaAttachments: HermitMediaAttachment[] = []
  const candidate = pickCandidateImageUrl(parsed)
  if (candidate) {
    const validated = inferPublicMediaAttachment(candidate)
    if (validated) {
      mediaAttachments.push(validated)
      // Append the URL to the textual reply so clients that don't
      // render attachments still surface a clickable link. Only do
      // this when the URL passed validation — we never echo a
      // rejected/non-image URL.
      replyParts.push(validated.url)
    }
  }

  const reply = replyParts.join('\n').trim() || rawText.trim()
  return {
    imagePrompt: imagePrompt || rawText.trim(),
    reply,
    mediaAttachments,
  }
}

function commandError(message: string): Error {
  return new Error(message)
}

export const _hermitPromptBuildersForTests = {
  language: HERMIT_LANGUAGE_DIRECTIVE,
  buildHermit: buildPinataPromptForHermit,
  buildImage: buildPinataPromptForHermitImage,
  buildGmeow: buildPinataPromptForGmeow,
  detectDialect: detectSpanishDialect,
  buildLanguageDirective: buildHermitLanguageDirective,
  buildMemoryPersistenceClause: buildSpanishMemoryPersistenceClause,
  flagMap: SPANISH_DIALECT_FLAG_MAP,
  inferPublicMediaAttachment,
  formatHermitImageResult,
  pickCandidateImageUrl,
}

/**
 * Best-effort persistence of an explicit dialect signal for the active
 * sender. Wraps the caller-supplied writer in try/catch so a write
 * failure cannot bubble up and break the chat reply.
 */
async function persistExplicitDialectSignal(
  params: HermitExecutionParams,
  detectedFrom: string,
  signalSource: 'flag' | 'text-hint',
): Promise<void> {
  if (!params.persistPreference) return
  const dialect = detectSpanishDialect(detectedFrom)
  if (dialect === null) return
  try {
    await params.persistPreference({
      preferenceKey: 'hermit.spanish_dialect',
      preferenceValue: dialect,
      updatedBy: `hermit.${signalSource}`,
    })
  } catch {
    // Non-fatal: chat reply must still go out.
  }
}

function classifyExplicitSignal(userInput: string): 'flag' | 'text-hint' | null {
  if (!userInput) return null
  for (const flag of Object.keys(SPANISH_DIALECT_FLAG_MAP)) {
    if (userInput.includes(flag)) return 'flag'
  }
  for (const { pattern } of SPANISH_DIALECT_TEXT_HINTS) {
    if (pattern.test(userInput)) return 'text-hint'
  }
  return null
}

// ── Hermit setup / personalization ──
//
// Per-user, per-room style preferences live in
// `alfaclub.user_preference` (see PR #465). The creative lane never
// imports the store directly — `executeHermitCommand` calls the
// caller-supplied `persistPreference` / `listPreferences` /
// `clearPreferences` callbacks injected by `frontend/server/commands/
// execute.ts`.

export const HERMIT_TONES = [
  'clean',
  'degen',
  'pro',
  'poetic',
  'spanglish',
  'chaotic',
  'concise',
] as const
export type HermitTone = (typeof HERMIT_TONES)[number]
const HERMIT_TONE_VALUES = new Set<string>(HERMIT_TONES)

export function asHermitTone(value: unknown): HermitTone | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return HERMIT_TONE_VALUES.has(normalized) ? (normalized as HermitTone) : null
}

const HERMIT_TONE_PROFILES: Record<HermitTone, string> = {
  clean: 'Clean tone: clear, professional, no slang, no caps spam.',
  degen:
    'Degen tone: crypto-native, irreverent, terse. Loanwords like gm, alpha, ape, ngmi are fine; never fabricate stats; no financial advice.',
  pro: 'Pro tone: measured, informational, executive-summary register; no slang, no exclamation spam.',
  poetic:
    'Poetic tone: imagistic, rhythmic phrasing; one striking image per line; still respect length and JSON constraints.',
  spanglish:
    'Spanglish tone: natural code-switch between English and casual Latin American Spanish; only when it sounds natural — do not force it.',
  chaotic:
    'Chaotic tone: high energy, abrupt cuts, occasional all-lowercase; still respect word count and JSON constraints; no vulgarity.',
  concise:
    'Concise tone: shortest line that lands; cut filler; no exclamation spam.',
}

function buildHermitToneClause(tone: HermitTone | null): string {
  if (!tone) return ''
  return `Tone: ${HERMIT_TONE_PROFILES[tone]}`
}

const HERMIT_SETUP_SUBCOMMANDS = new Set([
  'setup',
  'prefs',
  'reset',
  'lang',
  'tone',
  'alert',
])

function isFlagOnlyInput(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  for (const flag of Object.keys(SPANISH_DIALECT_FLAG_MAP)) {
    if (trimmed === flag) return true
  }
  return false
}

function buildHermitSetupReply(): string {
  return [
    'Hermit setup',
    '',
    "Set your style once and Hermit will remember it for this room.",
    '',
    'Language / dialect (also accepts a bare flag in any /hermit, /meme, /gmeow message):',
    '- 🇲🇽 Mexican Spanish — `/hermit lang 🇲🇽`',
    '- 🇦🇷 Rioplatense / Argentina — `/hermit lang 🇦🇷`',
    '- 🇨🇴 Colombian — `/hermit lang 🇨🇴`',
    '- 🇨🇱 Chilean — `/hermit lang 🇨🇱`',
    '- 🇵🇪 Peruvian — `/hermit lang 🇵🇪`',
    '- 🇻🇪 Venezuelan — `/hermit lang 🇻🇪`',
    '- 🇵🇷 Puerto Rican / Caribbean — `/hermit lang 🇵🇷`',
    '- 🇪🇸 European Spanish — `/hermit lang 🇪🇸`',
    '- 🌎 / 🇺🇳 Neutral Latin American — `/hermit lang 🌎`',
    '',
    'Tone — `/hermit tone <name>` where name is one of:',
    `  ${HERMIT_TONES.join(', ')}`,
    '',
    'Useful commands:',
    '- `/hermit prefs` — show what Hermit currently remembers for you',
    '- `/hermit reset` — clear your Hermit preferences for this room',
    '- `/hermit copy|announce|quest|tone <text>` — draft copy',
    '- `/meme <prompt>` — image meme prompt',
    '- `/gmeow [vibe]` — saved meme + Hermit one-liner',
  ].join('\n')
}

function formatHermitPrefLabel(key: string): string {
  switch (key) {
    case 'hermit.spanish_dialect':
      return 'Spanish dialect'
    case 'hermit.tone':
      return 'Tone'
    case 'hermit.onboarded':
      return 'Onboarded'
    default:
      return key
  }
}

async function buildHermitPrefsReply(params: HermitExecutionParams): Promise<string> {
  const lister = params.listPreferences
  if (!lister) {
    return [
      'Hermit prefs are not available on this surface.',
      'Personalization is only persisted inside an AlfaClub room.',
    ].join('\n')
  }
  let entries: Awaited<ReturnType<HermitPreferenceLister>> = []
  try {
    entries = await lister()
  } catch {
    entries = []
  }
  const interesting = entries.filter((entry) => entry.preferenceKey.startsWith('hermit.'))
  if (interesting.length === 0) {
    return [
      'Hermit has no saved preferences for you in this room yet.',
      'Set one with `/hermit lang <flag>` or `/hermit tone <name>` — see `/hermit setup`.',
    ].join('\n')
  }
  const lines = ['Your Hermit preferences in this room:']
  for (const entry of interesting) {
    const label = formatHermitPrefLabel(entry.preferenceKey)
    const value = entry.preferenceValue ? entry.preferenceValue : '(unset)'
    lines.push(`- ${label}: ${value}`)
  }
  lines.push('')
  lines.push('Change with `/hermit lang <flag>` / `/hermit tone <name>`. Clear with `/hermit reset`.')
  return lines.join('\n')
}

async function handleHermitSetupSubcommand(
  params: HermitExecutionParams,
  subcommand: string,
  args: string,
): Promise<HermitExecutionResult | null> {
  if (subcommand === 'setup') {
    return {
      kind: 'hermit',
      provider: 'local',
      reply: buildHermitSetupReply(),
    }
  }

  if (subcommand === 'prefs') {
    return {
      kind: 'hermit',
      provider: 'local',
      reply: await buildHermitPrefsReply(params),
    }
  }

  if (subcommand === 'reset') {
    let cleared = false
    if (params.clearPreferences) {
      try {
        cleared = await params.clearPreferences()
      } catch {
        cleared = false
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: cleared
        ? 'Hermit preferences cleared for this room. `/hermit setup` to start over.'
        : 'Could not clear preferences right now (storage unavailable). Try again in a moment.',
    }
  }

  if (subcommand === 'lang') {
    const dialect = detectSpanishDialect(args) ?? asSpanishDialect(args)
    if (!dialect) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: [
          'Unknown language. Use a flag or one of the supported dialect names.',
          'Try `/hermit lang 🇲🇽` or see `/hermit setup`.',
        ].join('\n'),
      }
    }
    let saved = false
    if (params.persistPreference) {
      try {
        await params.persistPreference({
          preferenceKey: 'hermit.spanish_dialect',
          preferenceValue: dialect,
          updatedBy: 'hermit.lang',
        })
        saved = true
      } catch {
        saved = false
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: saved
        ? `Hermit will favor "${dialect}" Spanish for you in this room. Use \`/hermit prefs\` to confirm.`
        : `Selected "${dialect}" Spanish for this turn, but storage is unavailable so it won't persist yet.`,
    }
  }

  if (subcommand === 'tone') {
    const tone = asHermitTone(args)
    if (!tone) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: [
          `Unknown tone. Use one of: ${HERMIT_TONES.join(', ')}.`,
          'See `/hermit setup` for examples.',
        ].join('\n'),
      }
    }
    let saved = false
    if (params.persistPreference) {
      try {
        await params.persistPreference({
          preferenceKey: 'hermit.tone',
          preferenceValue: tone,
          updatedBy: 'hermit.tone',
        })
        saved = true
      } catch {
        saved = false
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: saved
        ? `Hermit tone set to "${tone}" for this room. Use \`/hermit prefs\` to confirm.`
        : `Selected tone "${tone}" for this turn, but storage is unavailable so it won't persist yet.`,
    }
  }

  if (subcommand === 'alert') {
    return handleHermitAlertSubcommand(params, args)
  }

  return null
}

async function handleHermitAlertSubcommand(
  params: HermitExecutionParams,
  args: string,
): Promise<HermitExecutionResult> {
  const parsed = parseHermitAlertCommandArgs(args)
  if (parsed.action === 'invalid') {
    return { kind: 'hermit', provider: 'local', reply: parsed.reason }
  }

  const sender = params.senderAddress

  if (parsed.action === 'off') {
    await disableHyperliquidPositionAlert(sender)
    return {
      kind: 'hermit',
      provider: 'local',
      reply: 'Hyperliquid alerts disabled. Run `/position` anytime for a live HL snapshot.',
    }
  }

  if (parsed.action === 'status') {
    const alert = await readHyperliquidPositionAlert(sender)
    const telegramLinked = await resolveTelegramChatIdForWallet(sender)
    const lines = ['🔔 **Hyperliquid alert settings**', '', ...formatPositionAlertStatusBlock(alert)]
    if (telegramLinked) {
      lines.push(`• Linked Telegram: **yes**`)
    } else {
      lines.push('• Linked Telegram: **no** — link your wallet in the 4626 Telegram Mini App first')
    }
    return { kind: 'hermit', provider: 'local', reply: lines.join('\n') }
  }

  if (parsed.action === 'default') {
    const telegramLinked = await resolveTelegramChatIdForWallet(sender)
    const saved = await enableDefaultHyperliquidPositionAlert(sender, {
      telegramEnabled: telegramLinked ? true : false,
    })
    if (!saved) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Could not save alert settings right now. Try again in a moment.',
      }
    }
    const lines = [
      '✅ **Hyperliquid alerts on** (defaults)',
      '',
      ...describeHyperliquidAlertDefaults(),
    ]
    if (telegramLinked) {
      lines.push('', 'Telegram DMs **enabled** for this wallet.')
    } else {
      lines.push(
        '',
        'Telegram not linked yet — link via 4626 Telegram Mini App, then run `/hermit alert` again.',
      )
    }
    lines.push('', 'Live snapshot: `/position` · disable: `/hermit alert off`')
    return { kind: 'hermit', provider: 'local', reply: lines.join('\n') }
  }

  if (parsed.action === 'telegram') {
    if (parsed.enabled) {
      const chatId = await resolveTelegramChatIdForWallet(sender)
      if (!chatId) {
        return {
          kind: 'hermit',
          provider: 'local',
          reply:
            'No linked Telegram for this wallet. Link via 4626 Telegram, then retry `/hermit alert telegram on`.',
        }
      }
      await upsertHyperliquidPositionAlert({
        senderAddress: sender,
        enabled: true,
        telegramEnabled: true,
      })
      return {
        kind: 'hermit',
        provider: 'local',
        reply: `Telegram DMs **on** for Hyperliquid alerts. Set thresholds with \`/hermit alert liq 10\` and/or \`/hermit alert target 5000\`.`,
      }
    }
    await upsertHyperliquidPositionAlert({
      senderAddress: sender,
      telegramEnabled: false,
    })
    return {
      kind: 'hermit',
      provider: 'local',
      reply: 'Telegram DMs off. `/position` still works in chat anytime.',
    }
  }

  const telegramLinked = await resolveTelegramChatIdForWallet(sender)
  const autoTelegram = Boolean(telegramLinked)

  if (parsed.action === 'liq') {
    const saved = await upsertHyperliquidPositionAlert({
      senderAddress: sender,
      enabled: true,
      liquidationWarnPct: parsed.pct,
      ...(autoTelegram ? { telegramEnabled: true } : {}),
    })
    if (!saved) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Could not save alert settings right now. Try again in a moment.',
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: [
        `Hyperliquid liquidation alert **on** — Telegram when **any open leg** is within **${parsed.pct}%** of liquidation.`,
        autoTelegram
          ? 'Telegram DMs enabled (wallet linked).'
          : 'Link Telegram to 4626 to receive DMs, or run `/hermit alert telegram on` after linking.',
        'Check live levels with `/position`.',
      ].join('\n'),
    }
  }

  if (parsed.action === 'target') {
    const saved = await upsertHyperliquidPositionAlert({
      senderAddress: sender,
      enabled: true,
      targetPnlUsd: parsed.usd,
      ...(autoTelegram ? { telegramEnabled: true } : {}),
    })
    if (!saved) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Could not save alert settings right now. Try again in a moment.',
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: [
        `Hyperliquid target alert **on** — combined unrealized PnL **+$${parsed.usd.toLocaleString('en-US')}**.`,
        'Default fire at 90% of target; override with `/hermit alert progress 80`.',
        autoTelegram
          ? 'Telegram DMs enabled (wallet linked).'
          : 'Link Telegram to 4626 to receive DMs.',
      ].join('\n'),
    }
  }

  if (parsed.action === 'progress') {
    const saved = await upsertHyperliquidPositionAlert({
      senderAddress: sender,
      enabled: true,
      targetProgressPct: parsed.pct,
    })
    if (!saved) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Could not save alert settings right now. Try again in a moment.',
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: `Target alert will fire at **${parsed.pct}%** of your configured HL PnL target.`,
    }
  }

  return {
    kind: 'hermit',
    provider: 'local',
    reply: 'Unknown alert command. Try `/hermit alert status`.',
  }
}

async function buildPositionCommandReply(params: HermitExecutionParams): Promise<string> {
  const wallet = params.senderAddress
  const hlState = await getClearinghouseState(wallet)
  const alert = await readHyperliquidPositionAlert(wallet)
  return buildHyperliquidPositionReport({
    walletAddress: wallet,
    hlState,
    alert,
  })
}

const HERMIT_ONBOARDING_NUDGE =
  '— Want me to remember your style? Reply with a flag for Spanish dialect, or use `/hermit setup`.'

function shouldShowOnboardingNudge(params: HermitExecutionParams): boolean {
  if (!params.persistPreference) return false
  if (!params.roomId) return false
  const onboardedAt = params.userPreferences?.onboardedAt ?? null
  return !(typeof onboardedAt === 'string' && onboardedAt.trim().length > 0)
}

async function markHermitOnboarded(params: HermitExecutionParams): Promise<void> {
  if (!params.persistPreference) return
  try {
    await params.persistPreference({
      preferenceKey: 'hermit.onboarded',
      preferenceValue: new Date().toISOString(),
      updatedBy: 'hermit.onboarding',
    })
  } catch {
    // Best-effort: nudge will fire again on the next turn if this fails.
  }
}

async function withOnboardingNudge(
  params: HermitExecutionParams,
  result: HermitExecutionResult,
): Promise<HermitExecutionResult> {
  if (!shouldShowOnboardingNudge(params)) return result
  if (!result.reply || !result.reply.trim()) return result
  await markHermitOnboarded(params)
  return {
    ...result,
    reply: `${result.reply}\n\n${HERMIT_ONBOARDING_NUDGE}`,
  }
}

export async function executeHermitCommand(
  params: HermitExecutionParams,
): Promise<HermitExecutionResult> {
  const { command, args } = splitCommandAndArgs(params.commandText)
  const userPreferences: HermitUserPreferences | null = params.userPreferences ?? null

  if (command === '/position') {
    return {
      kind: 'hermit',
      provider: 'local',
      reply: await buildPositionCommandReply(params),
    }
  }

  if (command === '/gmeow') {
    const vibeTag = args.trim() || undefined
    const meme = pickRandomHermitMeme(vibeTag)
    const attachment = inferPublicMediaAttachment(meme.url)
    const localLine = pickGmeowLocalLine(meme)
    const localReply = `${localLine}\n${meme.url}`
    const explicitSignalSource = classifyExplicitSignal(args)
    let draft: PinataChatResult | null = null
    let fallbackReason: 'pinata_throw' | 'pinata_provider_error_text' | null = null
    const pinataCaptionRequested =
      shouldRequestPinataGmeowCaption(args) && readPinataHermitConfig() !== null
    if (pinataCaptionRequested) {
      try {
        draft = await runPinataDraft({
          prompt: buildPinataPromptForGmeow({
            userPrompt: args,
            memeCaption: meme.caption,
            memeTags: meme.tags,
            userPreferences,
          }),
          senderAddress: params.senderAddress,
          sourceIdentity: params.sourceIdentity ?? null,
        })
      } catch (error) {
        fallbackReason = 'pinata_throw'
        logger.warn('[hermit] /gmeow draft failed; using local fallback', {
          error: error instanceof Error ? error.message : String(error),
        })
        draft = null
      }
    }
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, args, explicitSignalSource)
    }
    const parsed = draft?.text ? parseLooseJsonObject(draft.text) : null
    const draftedLineRaw =
      asString(parsed?.line) || asString(parsed?.caption) || asString(parsed?.text) || asString(draft?.text)
    const draftedLineLooksLikeProviderError = isLikelyPinataProviderErrorText(draftedLineRaw)
    if (!fallbackReason && draftedLineLooksLikeProviderError) {
      fallbackReason = 'pinata_provider_error_text'
      logger.warn('[hermit] /gmeow provider returned fallback-worthy text; using local fallback', {
        replyHead: draftedLineRaw.slice(0, 120),
      })
    }
    const draftedLine = draftedLineLooksLikeProviderError ? '' : draftedLineRaw
    const reply = draftedLine ? `${draftedLine}\n${meme.url}` : localReply
    const provider = draftedLine ? 'pinata' : 'local'
    logger.info('[hermit] /gmeow resolved', {
      provider,
      fallbackReason,
      pinataCaptionRequested,
      hasAttachment: Boolean(attachment),
      explicitSignalSource,
    })
    const result: HermitExecutionResult = {
      kind: 'gmeow',
      provider,
      meme,
      reply,
      ...(attachment ? { mediaAttachments: [attachment] } : {}),
    }
    return await withOnboardingNudge(params, result)
  }

  if (command === '/meme') {
    const explicitSignalSource = classifyExplicitSignal(args)
    const draft = await runPinataDraft({
      prompt: buildPinataPromptForHermitImage(args, userPreferences),
      senderAddress: params.senderAddress,
      sourceIdentity: params.sourceIdentity ?? null,
    })
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, args, explicitSignalSource)
    }
    if (!draft?.text) {
      throw commandError(
        'Hermit meme path unavailable. Configure HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN.',
      )
    }
    const image = formatHermitImageResult(draft.text)
    const result: HermitExecutionResult = {
      kind: 'meme',
      provider: 'pinata',
      imagePrompt: image.imagePrompt,
      reply: image.reply,
      ...(image.mediaAttachments.length > 0
        ? { mediaAttachments: image.mediaAttachments }
        : {}),
    }
    return await withOnboardingNudge(params, result)
  }

  if (command === '/hermit') {
    if (!args || args.toLowerCase() === 'help') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: buildHermitHelpReply(params.roomId),
      }
    }

    // Setup / personalization subcommands run locally — no Pinata
    // call, no onboarding nudge (the user is explicitly in setup
    // mode already, so the nudge would be redundant). They are
    // routed BEFORE parseHermitDraftMode so the words `setup`,
    // `prefs`, `reset`, `lang`, `tone` are interpreted as
    // subcommands rather than draft modes.
    //
    // Note: there is an existing `/hermit tone <message>` draft mode
    // that rewrites a multi-word message in a sharper social tone.
    // Disambiguate on argument shape, not on tone-name validity:
    //   - `/hermit tone <single-token>` → personalization path. A
    //     recognised name persists; an unrecognised single token
    //     returns local "Unknown tone" guidance instead of falling
    //     through to a Pinata call.
    //   - `/hermit tone <multi-word message>` → existing draft/rewrite
    //     path so power users keep `/hermit tone make this clearer…`
    //     etc. (these always contain whitespace).
    // A bare `/hermit tone` with no args is ambiguous; we route it
    // through the personalization handler, which prints the "Unknown
    // tone. Use one of: …" hint — much friendlier than firing off an
    // empty rewrite.
    const firstSpace = args.indexOf(' ')
    const subToken = (firstSpace === -1 ? args : args.slice(0, firstSpace))
      .trim()
      .toLowerCase()
    const subArgs = firstSpace === -1 ? '' : args.slice(firstSpace + 1).trim()
    if (HERMIT_SETUP_SUBCOMMANDS.has(subToken)) {
      if (subToken === 'tone') {
        const looksLikeSingleTonePick = !subArgs || /^[A-Za-z_-]+$/.test(subArgs)
        if (looksLikeSingleTonePick) {
          const handled = await handleHermitSetupSubcommand(params, subToken, subArgs)
          if (handled) return handled
        }
        // Multi-word args (whitespace, punctuation): fall through
        // to the existing tone draft path.
      } else {
        const handled = await handleHermitSetupSubcommand(params, subToken, subArgs)
        if (handled) return handled
      }
    } else if (isFlagOnlyInput(args)) {
      // Bare flag-only message in /hermit — treat as `/hermit lang <flag>`.
      const handled = await handleHermitSetupSubcommand(params, 'lang', args)
      if (handled) return handled
    }

    const { mode, prompt } = parseHermitDraftMode(args)
    const explicitSignalSource = classifyExplicitSignal(prompt)
    const draft = await runPinataDraft({
      prompt: buildPinataPromptForHermit({
        mode,
        userPrompt: prompt,
        userPreferences,
        room1659Market: params.room1659Market,
      }),
      senderAddress: params.senderAddress,
      sourceIdentity: params.sourceIdentity ?? null,
    })
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, prompt, explicitSignalSource)
    }
    if (!draft?.text) {
      throw commandError(
        'Hermit Pinata path unavailable. Configure HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN.',
      )
    }
    const result: HermitExecutionResult = {
      kind: 'hermit',
      provider: 'pinata',
      reply: formatHermitReplyFromDraft(draft.text),
    }
    return await withOnboardingNudge(params, result)
  }

  throw commandError(
    'Unsupported Hermit command. Use /gmeow, /hermit [copy|announce|quest|tone], or /meme.',
  )
}
