/**
 * Hermit creative lane — strict architectural boundary.
 *
 * This module owns ONLY creative generation (`/hermit`, `/meme`, `/gmeow`)
 * by delegating to a Hermit-hosted creative agent endpoint. It must not:
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
import { logger } from '../infra/logger.js'
import { getClearinghouseState } from '../alfaclub/hyperliquid.js'
import {
  formatRoom1659MarketForHermit,
  resolveRoom1659MarketContext,
  resolveRoom1659HyperliquidUserForSnapshot,
} from '../alfaclub/room1659Market.js'
import { buildAlfaClubBriefContext } from '../alfaclub/dailyBrief.js'
import {
  buildHyperliquidEntrySignalReport,
  buildHyperliquidPositionReport,
  formatPositionAlertStatusBlock,
} from '../alfaclub/positionReport.js'
import { buildRoomTimelineData, type RoomTimelineChatEvent } from '../alfaclub/roomTimeline.js'
import {
  disableHyperliquidPositionAlert,
  describeHyperliquidAlertDefaults,
  enableDefaultHyperliquidPositionAlert,
  parseHermitAlertCommandArgs,
  readHyperliquidPositionAlert,
  resolveTelegramChatIdForWallet,
  upsertHyperliquidPositionAlert,
} from '../alfaclub/positionAlertStore.js'
import { arenaCommandAllowedForRoom, readArenaConfig } from '../arena/arenaConfig.js'
import {
  listArenaAssets,
  runArenaActivateUnifiedAccount,
  runArenaAddApiWallet,
  runArenaDepositUsdc,
  runArenaJoin,
  runArenaStatus,
  runArenaTrade,
} from '../arena/arenaClient.js'

declare const process: { env: Record<string, string | undefined> }

type PinataChatResult = {
  text: string
}

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

function readPinataHttpTimeoutMs(): number {
  const raw = asTrimmed(process.env.HERMIT_AGENT_HTTP_TIMEOUT_MS)
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

type ParsedArenaCommand =
  | { kind: 'help' | 'status' | 'assets' | 'join' | 'activate' | 'add-api-wallet' }
  | { kind: 'deposit'; amountUsd: number }
  | {
      kind: 'trade'
      action: 'open' | 'close'
      pair: string
      side?: 'long' | 'short'
      sizeUsd?: number
      leverage?: number
    }

function parseArenaCommandArgs(args: string): ParsedArenaCommand | null {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help') return { kind: 'help' }
  const parts = trimmed.split(/\s+/)
  const sub = (parts[0] ?? '').toLowerCase()

  if (sub === 'status') return { kind: 'status' }
  if (sub === 'assets') return { kind: 'assets' }
  if (sub === 'join') return { kind: 'join' }
  if (sub === 'activate' || sub === 'activate-unified-account') return { kind: 'activate' }
  if (sub === 'add-api-wallet' || sub === 'api-wallet') return { kind: 'add-api-wallet' }

  if (sub === 'deposit') {
    const amountUsd = Number(parts[1] ?? '')
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null
    return { kind: 'deposit', amountUsd }
  }

  if (sub === 'trade') {
    const action = (parts[1] ?? '').toLowerCase()
    if (action === 'close') {
      const pair = parts[2] ?? ''
      if (!pair) return null
      return { kind: 'trade', action: 'close', pair }
    }
    if (action === 'open') {
      const pair = parts[2] ?? ''
      const side = (parts[3] ?? '').toLowerCase()
      const sizeUsd = Number(parts[4] ?? '')
      const leverage = Number(parts[5] ?? '')
      if (!pair || (side !== 'long' && side !== 'short')) return null
      if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return null
      if (!Number.isFinite(leverage) || leverage <= 0) return null
      return {
        kind: 'trade',
        action: 'open',
        pair,
        side,
        sizeUsd,
        leverage,
      }
    }
  }
  return null
}

function formatArenaUsage(): string {
  return [
    '**Arena controls (room-gated)**',
    '- `/arena status`',
    '- `/arena assets`',
    '- `/arena join`',
    '- `/arena activate`',
    '- `/arena add-api-wallet`',
    '- `/arena deposit <usdc>`',
    '- `/arena trade open <pair> <long|short> <sizeUsd> <leverage>`',
    '- `/arena trade close <pair>`',
    '',
    'HIP-3 pairs must use `xyz:` (example: `xyz:GOLD`).',
  ].join('\n')
}

function trimList(values: string[], max = 6): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, max)
}

const ALERT_TEST_DM_TIMEOUT_MS = 12_000

function readPositionAlertBotToken(): string | null {
  const candidates = [
    process.env.ALFACLUB_API_KEY,
    process.env.alfaclub_api_key,
    process.env.ALFACLUB_BOT_TOKEN,
  ]
  for (const candidate of candidates) {
    const value = asTrimmed(candidate)
    if (value) return value
  }
  return null
}

async function sendTelegramAlertTestDm(params: {
  chatId: string
  senderAddress: string
  botToken: string
}): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ALERT_TEST_DM_TIMEOUT_MS)
  const text = [
    '🧪 **Hermit alert test**',
    `Wallet ${params.senderAddress.slice(0, 6)}…${params.senderAddress.slice(-4)}`,
    'Telegram delivery is configured for this wallet.',
    'You will now receive Hyperliquid alert DMs when your thresholds are triggered.',
  ].join('\n')
  try {
    const response = await fetch(`https://api.telegram.org/bot${params.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: params.chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
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

function readHermitAgentConfig(): { endpoint: string; bearer: string } | null {
  const endpoint = asTrimmed(process.env.HERMIT_AGENT_CHAT_ENDPOINT)
  const bearer = asTrimmed(process.env.HERMIT_AGENT_BEARER_TOKEN)
  if (!endpoint || !bearer) return null
  return { endpoint, bearer }
}

/**
 * Whether /gmeow should call Hermit agent for an extra caption line.
 *
 * Default (env unset): Hermit-agent one-liner when configured; else local hooks + rotating GIFs.
 * - `HERMIT_GMEOW_HERMIT_CAPTION=always` — call Hermit agent on every /gmeow when configured.
 * - `HERMIT_GMEOW_HERMIT_CAPTION=prompt` — call Hermit agent only when the user adds text after /gmeow.
 * - `HERMIT_GMEOW_HERMIT_CAPTION=0` — never call Hermit agent for /gmeow (local hooks only).
 * - `HERMIT_GMEOW_HERMIT_CAPTION=local` — force local hooks even when Hermit agent is configured.
 */
export function shouldRequestPinataGmeowCaption(userPromptAfterCommand: string): boolean {
  const mode = asTrimmed(process.env.HERMIT_GMEOW_HERMIT_CAPTION)
  const normalizedMode = mode.toLowerCase()
  if (normalizedMode === '0' || normalizedMode === 'false' || normalizedMode === 'no' || normalizedMode === 'off' || normalizedMode === 'never') {
    return false
  }
  if (normalizedMode === 'local' || normalizedMode === 'offline') {
    return false
  }
  if (
    normalizedMode === '1' ||
    normalizedMode === 'true' ||
    normalizedMode === 'yes' ||
    normalizedMode === 'on' ||
    normalizedMode === 'always' ||
    normalizedMode === 'all' ||
    normalizedMode === 'legacy'
  ) {
    return true
  }
  if (normalizedMode === 'prompt' || normalizedMode === 'args' || normalizedMode === 'text') {
    return userPromptAfterCommand.trim().length > 0
  }
  // Env unset: creative Hermit-agent line when endpoint is configured (caller still gates on config).
  return true
}

function toPinataHttpChatUrl(rawEndpoint: string): string {
  return rawEndpoint
}

export function pinataEndpointSupportsHttpDraft(rawEndpoint: string | undefined): boolean {
  const endpoint = asTrimmed(rawEndpoint)
  if (!endpoint) return false
  return endpoint.startsWith('http://') || endpoint.startsWith('https://')
}

/**
 * Hermit draft calls are HTTP-only and must target first-party endpoints
 * (Vercel or Railway), not Pinata gateway chat transports.
 */
export function shouldPreferPinataHttpDraft(params: {
  sourceIdentity?: string | null
  prompt: string
  endpoint?: string | null
}): boolean {
  const endpoint = asTrimmed(params.endpoint) || asTrimmed(process.env.HERMIT_AGENT_CHAT_ENDPOINT)
  if (!pinataEndpointSupportsHttpDraft(endpoint)) return false
  return true
}

async function runPinataDraftOverHttp(params: {
  endpoint: string
  bearer: string
  prompt: string
}): Promise<PinataChatResult | null> {
  // Bound by `HERMIT_AGENT_HTTP_TIMEOUT_MS` so a hung creative backend
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
  const cfg = readHermitAgentConfig()
  if (!cfg) return null

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
    '- `/position` — your HL snapshot + proactive risk brief',
    '- `/position chart` — timeline chart link + marker counts',
    '- `/position markers all` — expanded trade/chat marker list',
    '- `/position host markers` — host-only chat markers',
    '- `/position sender <address|me>` — sender-specific chat markers',
    '- `/position marker latest|trade 1|host 1|<n>` — inspect marker context',
    '- `/signal` — position-aware enter/exit bias from your live entries',
    '- `/market` — broader majors + AlfaClub market scope',
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
  const sender = params.senderAddress
  try {
    const parsed = parseHermitAlertCommandArgs(args)
    if (parsed.action === 'invalid') {
      return { kind: 'hermit', provider: 'local', reply: parsed.reason }
    }

    if (parsed.action === 'off') {
      await disableHyperliquidPositionAlert(sender)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Hyperliquid alerts disabled. Run `/position` anytime for a live HL snapshot.',
      }
    }

    if (parsed.action === 'test') {
      const botToken = readPositionAlertBotToken()
      if (!botToken) {
        return {
          kind: 'hermit',
          provider: 'local',
          reply:
            'Telegram alert test failed: bot token is not configured on this runtime. Set `ALFACLUB_API_KEY` (and/or Telegram relay token) and retry.',
        }
      }
      const chatId = await resolveTelegramChatIdForWallet(sender)
      if (!chatId) {
        return {
          kind: 'hermit',
          provider: 'local',
          reply:
            'Telegram alert test failed: no linked Telegram for this wallet. Link in the 4626 Telegram Mini App, then retry `/hermit alert test`.',
        }
      }
      const sent = await sendTelegramAlertTestDm({
        chatId,
        senderAddress: sender,
        botToken,
      })
      if (sent) {
        return {
          kind: 'hermit',
          provider: 'local',
          reply: `Telegram alert test sent ✅ (chat ${chatId}).`,
        }
      }
      return {
        kind: 'hermit',
        provider: 'local',
        reply:
          'Telegram alert test failed during send. Check bot permissions/chat access, then retry `/hermit alert test`.',
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
      lines.push('Verify delivery now: `/hermit alert test`')
      return {
        kind: 'hermit',
        provider: 'local',
        reply: lines.join('\n'),
      }
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
  } catch (error) {
    logger.warn('[hermit] alert subcommand failed', {
      senderAddress: sender,
      message: error instanceof Error ? error.message : String(error),
    })
    return {
      kind: 'hermit',
      provider: 'local',
      reply:
        'Hermit alert service is temporarily unavailable. Retry `/hermit alert status` in a moment.',
    }
  }
}

async function buildPositionCommandReply(params: HermitExecutionParams): Promise<string> {
  // Room 1659 tracks a dedicated room-level Hyperliquid portfolio rather than
  // the sender's personal wallet. Keep alert config per-sender, but pull HL
  // positions for the room portfolio so /position matches the room context.
  const hlWallet =
    params.roomId === '1659'
      ? resolveRoom1659HyperliquidUserForSnapshot(params.senderAddress)
      : params.senderAddress
  const hlState = await getClearinghouseState(hlWallet)
  const alert = await readHyperliquidPositionAlert(params.senderAddress)
  const room1659Market =
    params.roomId === '1659' ? await resolveRoom1659MarketContext(params.senderAddress) : null
  const marketBrief = await buildMarketScopeSummary()
  return buildHyperliquidPositionReport({
    walletAddress: hlWallet,
    hlState,
    alert,
    roomId: params.roomId ?? null,
    room1659Market,
    marketBrief,
  })
}

type PositionMarkerEvent =
  | {
      markerIndex: number
      time: number
      kind: 'trade'
      summary: string
      trade: {
        action: string
        coin: string | null
        side: 'long' | 'short' | null
        price: number | null
        size: number | null
        dir: string | null
        closedPnl: number
        fee: number
      }
    }
  | {
      markerIndex: number
      time: number
      kind: 'chat'
      summary: string
      chat: RoomTimelineChatEvent
    }

function formatMarkerTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toMarkerSummary(event: PositionMarkerEvent): string {
  if (event.kind === 'trade') {
    const action = event.trade.action.toUpperCase()
    const coin = event.trade.coin ?? 'HL'
    const price = event.trade.price != null ? `$${event.trade.price.toFixed(2)}` : 'price ?'
    const size = event.trade.size != null ? `${event.trade.size.toFixed(4)} size` : 'size ?'
    return `[${event.markerIndex}] ${formatMarkerTime(event.time)} · TRADE ${action} ${coin} · ${price} · ${size}`
  }

  const who =
    event.chat.senderLabel?.trim() ||
    `${event.chat.senderAddress.slice(0, 6)}…${event.chat.senderAddress.slice(-4)}`
  const hostTag = event.chat.isHost ? 'host' : 'chat'
  const firstTag = event.chat.isFirstFromSender ? ' · first message' : ''
  const text = event.chat.text.replace(/\s+/g, ' ').slice(0, 120)
  return `[${event.markerIndex}] ${formatMarkerTime(event.time)} · ${hostTag}${firstTag} · ${who} · "${text}${event.chat.text.length > 120 ? '…' : ''}"`
}

async function buildPositionMarkerEvents(params: HermitExecutionParams): Promise<PositionMarkerEvent[]> {
  if (!params.roomId) return []
  const timeline = await buildRoomTimelineData({
    roomId: params.roomId,
    windowHours: 24 * 7,
  })
  const merged: Array<Omit<PositionMarkerEvent, 'markerIndex'>> = [
    ...timeline.tradeEvents.map((trade) => ({
      kind: 'trade' as const,
      time: trade.time,
      summary: '',
      trade: {
        action: trade.action,
        coin: trade.coin,
        side: trade.side,
        price: trade.price,
        size: trade.size,
        dir: trade.dir,
        closedPnl: trade.closedPnl,
        fee: trade.fee,
      },
    })),
    ...timeline.chatEvents.map((chat) => ({
      kind: 'chat' as const,
      time: chat.time,
      summary: '',
      chat,
    })),
  ]

  merged.sort((a, b) => a.time - b.time)
  const events = merged.map((event, idx) => ({
    ...event,
    markerIndex: idx + 1,
  }))
  return events.map((event) => ({
    ...event,
    summary: toMarkerSummary(event),
  }))
}

function positionSubcommandUsage(): string {
  return [
    'Position timeline commands:',
    '- `/position` — live Hyperliquid snapshot + risk brief',
    '- `/position chart` — timeline chart link + marker counts',
    '- `/position markers all` — expanded numbered marker feed (trade + chat)',
    '- `/position host markers` — host-only chat marker feed',
    '- `/position sender <address|me>` — sender-specific chat marker feed',
    '- `/position marker latest` — newest marker',
    '- `/position marker trade <n>` — nth most recent trade marker (1 = newest)',
    '- `/position marker host <n>` — nth most recent host-chat marker (1 = newest)',
    '- `/position marker <n>` — exact marker index from marker lists',
  ].join('\n')
}

async function buildPositionChartCommandReply(params: HermitExecutionParams): Promise<string> {
  if (!params.roomId) {
    return 'Timeline chart mode is available in AlfaClub room contexts only.'
  }
  const events = await buildPositionMarkerEvents(params)
  const trades = events.filter((event) => event.kind === 'trade').length
  const chats = events.filter((event) => event.kind === 'chat').length
  const hostChats = events.filter((event) => event.kind === 'chat' && event.chat.isHost).length
  return [
    '📈 **Position timeline chart**',
    `Room ${params.roomId} · markers: ${events.length} total (${trades} trades, ${chats} chats, ${hostChats} host chats)`,
    'Open: https://app.4626.fun/positions',
    '',
    'In chat:',
    '- `/position markers all` for the full indexed list',
    '- `/position host markers` for host-only chats',
    '- `/position sender <address|me>` for one sender',
    '- `/position marker <n>` to inspect one marker',
  ].join('\n')
}

async function buildPositionMarkersAllReply(params: HermitExecutionParams): Promise<string> {
  if (!params.roomId) {
    return 'Marker feed is available in AlfaClub room contexts only.'
  }
  const events = await buildPositionMarkerEvents(params)
  if (events.length === 0) {
    return 'No timeline markers found in this window yet. Retry after new fills or chat activity.'
  }
  const maxRows = 80
  const slice = events.slice(-maxRows)
  return [
    `🧭 **Timeline markers** (latest ${slice.length} of ${events.length})`,
    ...slice.map((event) => event.summary),
    '',
    'Inspect one marker: `/position marker <n>`',
  ].join('\n')
}

function normalizePositionSenderFilter(raw: string, senderAddress: string): string | null {
  const token = raw.trim().toLowerCase()
  if (!token) return null
  if (token === 'me') return senderAddress.toLowerCase()
  if (/^0x[a-f0-9]{40}$/.test(token)) return token
  return null
}

async function buildPositionFilteredChatMarkersReply(
  params: HermitExecutionParams,
  filter:
    | { kind: 'host' }
    | {
        kind: 'sender'
        senderAddress: string
      },
): Promise<string> {
  if (!params.roomId) {
    return 'Marker feed is available in AlfaClub room contexts only.'
  }
  const events = await buildPositionMarkerEvents(params)
  const chats = events.filter(
    (event): event is Extract<PositionMarkerEvent, { kind: 'chat' }> => event.kind === 'chat',
  )
  const filtered =
    filter.kind === 'host'
      ? chats.filter((event) => event.chat.isHost)
      : chats.filter((event) => event.chat.senderAddress.toLowerCase() === filter.senderAddress)

  if (filtered.length === 0) {
    if (filter.kind === 'host') {
      return 'No host chat markers found in this timeline window yet.'
    }
    return `No chat markers found for ${filter.senderAddress} in this timeline window yet.`
  }

  const maxRows = 80
  const slice = filtered.slice(-maxRows)
  const heading =
    filter.kind === 'host'
      ? `🧭 **Host chat markers** (latest ${slice.length} of ${filtered.length})`
      : `🧭 **Sender chat markers** (${filter.senderAddress.slice(0, 6)}…${filter.senderAddress.slice(-4)}) — latest ${slice.length} of ${filtered.length}`

  return [
    heading,
    ...slice.map((event) => event.summary),
    '',
    'Inspect one marker: `/position marker <n>`',
  ].join('\n')
}

async function buildPositionMarkerDetailReply(
  params: HermitExecutionParams,
  markerSelector:
    | { kind: 'index'; markerIndex: number }
    | { kind: 'latest' }
    | { kind: 'trade_recent'; nth: number }
    | { kind: 'host_recent'; nth: number },
): Promise<string> {
  if (!params.roomId) {
    return 'Marker detail is available in AlfaClub room contexts only.'
  }
  const events = await buildPositionMarkerEvents(params)
  if (events.length === 0) {
    return 'No timeline markers found in this window yet. Retry after new fills or chat activity.'
  }

  const targetBySelector = (() => {
    if (markerSelector.kind === 'index') {
      return events.find((event) => event.markerIndex === markerSelector.markerIndex) ?? null
    }
    if (markerSelector.kind === 'latest') {
      return events[events.length - 1] ?? null
    }
    if (markerSelector.kind === 'trade_recent') {
      const trades = events.filter(
        (event): event is Extract<PositionMarkerEvent, { kind: 'trade' }> => event.kind === 'trade',
      )
      if (trades.length === 0) return null
      return trades[trades.length - markerSelector.nth] ?? null
    }
    const hostChats = events.filter(
      (event): event is Extract<PositionMarkerEvent, { kind: 'chat' }> =>
        event.kind === 'chat' && event.chat.isHost,
    )
    if (hostChats.length === 0) return null
    return hostChats[hostChats.length - markerSelector.nth] ?? null
  })()

  const target = targetBySelector
  if (!target) {
    if (markerSelector.kind === 'index') {
      return `Marker #${markerSelector.markerIndex} not found. Use \`/position markers all\` for valid indexes.`
    }
    if (markerSelector.kind === 'trade_recent') {
      return `Trade marker #${markerSelector.nth} not found. Use \`/position markers all\` to inspect available trades.`
    }
    if (markerSelector.kind === 'host_recent') {
      return `Host marker #${markerSelector.nth} not found. Use \`/position host markers\` to inspect available host chats.`
    }
    return 'No latest marker found. Use `/position markers all` first.'
  }

  if (target.kind === 'trade') {
    const side = target.trade.side?.toUpperCase() ?? 'UNKNOWN'
    const price = target.trade.price != null ? `$${target.trade.price.toFixed(2)}` : 'n/a'
    const size = target.trade.size != null ? target.trade.size.toFixed(6) : 'n/a'
    const pnl = `${target.trade.closedPnl >= 0 ? '+' : ''}${target.trade.closedPnl.toFixed(2)}`
    const fee = target.trade.fee.toFixed(4)
    return [
      `🔎 **Marker #${target.markerIndex}** · trade`,
      `${formatMarkerTime(target.time)} · ${target.trade.action.toUpperCase()} ${target.trade.coin ?? 'HL'} · ${side}`,
      `price ${price} · size ${size} · closedPnL ${pnl} · fee ${fee}`,
      target.trade.dir ? `dir: ${target.trade.dir}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const chat = target.chat
  const who =
    chat.senderLabel?.trim() || `${chat.senderAddress.slice(0, 6)}…${chat.senderAddress.slice(-4)}`
  const replies = events
    .filter((event): event is Extract<PositionMarkerEvent, { kind: 'chat' }> => event.kind === 'chat')
    .filter((event) => event.chat.replyId != null && event.chat.replyId === chat.messageId)
    .slice(0, 8)
  return [
    `💬 **Marker #${target.markerIndex}** · ${chat.isHost ? 'host chat' : 'chat'}`,
    `${formatMarkerTime(chat.time)} · ${who}${chat.isFirstFromSender ? ' · first message' : ''}`,
    '',
    chat.text,
    chat.replyText ? ['', `In reply to (${chat.replySenderLabel || chat.replySender || 'unknown'}):`, chat.replyText] : [],
    replies.length > 0
      ? [
          '',
          `Replies (${replies.length} shown):`,
          ...replies.map((reply) => {
            const replyWho =
              reply.chat.senderLabel?.trim() ||
              `${reply.chat.senderAddress.slice(0, 6)}…${reply.chat.senderAddress.slice(-4)}`
            return `- ${formatMarkerTime(reply.chat.time)} · ${replyWho}: ${reply.chat.text.replace(/\s+/g, ' ').slice(0, 180)}${reply.chat.text.length > 180 ? '…' : ''}`
          }),
        ]
      : [],
  ]
    .flat()
    .join('\n')
}

type PositionSubcommand =
  | { kind: 'default' }
  | { kind: 'chart' }
  | { kind: 'markers_all' }
  | { kind: 'host_markers' }
  | { kind: 'sender_markers'; senderToken: string }
  | {
      kind: 'marker'
      selector:
        | { kind: 'index'; markerIndex: number }
        | { kind: 'latest' }
        | { kind: 'trade_recent'; nth: number }
        | { kind: 'host_recent'; nth: number }
    }
  | { kind: 'usage' }

function parsePositionSubcommand(rawArgs: string): PositionSubcommand {
  const args = rawArgs.trim()
  if (!args) return { kind: 'default' }
  if (/^chart$/i.test(args)) return { kind: 'chart' }
  if (/^markers\s+all$/i.test(args)) return { kind: 'markers_all' }
  if (/^host\s+markers$/i.test(args)) return { kind: 'host_markers' }
  const senderMatch = args.match(/^sender\s+(.+)$/i)
  if (senderMatch?.[1]) return { kind: 'sender_markers', senderToken: senderMatch[1].trim() }
  if (/^marker\s+latest$/i.test(args) || /^marker\s+last$/i.test(args)) {
    return { kind: 'marker', selector: { kind: 'latest' } }
  }
  const markerTradeMatch = args.match(/^marker\s+trade\s+(\d+)$/i)
  if (markerTradeMatch?.[1]) {
    return {
      kind: 'marker',
      selector: { kind: 'trade_recent', nth: Number(markerTradeMatch[1]) },
    }
  }
  const markerHostMatch = args.match(/^marker\s+host\s+(\d+)$/i)
  if (markerHostMatch?.[1]) {
    return {
      kind: 'marker',
      selector: { kind: 'host_recent', nth: Number(markerHostMatch[1]) },
    }
  }
  const markerMatch = args.match(/^marker\s+(\d+)$/i)
  if (markerMatch?.[1]) {
    return {
      kind: 'marker',
      selector: { kind: 'index', markerIndex: Number(markerMatch[1]) },
    }
  }
  return { kind: 'usage' }
}

async function buildSignalCommandReply(params: HermitExecutionParams): Promise<string> {
  const hlWallet =
    params.roomId === '1659'
      ? resolveRoom1659HyperliquidUserForSnapshot(params.senderAddress)
      : params.senderAddress
  const [hlState, room1659Market, marketBrief] = await Promise.all([
    getClearinghouseState(hlWallet),
    params.roomId === '1659' ? resolveRoom1659MarketContext(params.senderAddress) : Promise.resolve(null),
    buildMarketScopeSummary(),
  ])

  return buildHyperliquidEntrySignalReport({
    walletAddress: hlWallet,
    hlState,
    roomId: params.roomId ?? null,
    room1659Market,
    marketBrief,
  })
}

async function buildMarketScopeSummary(): Promise<{
  snapshotTs: string | null
  previousSnapshotTs: string | null
  majors: Array<{ symbol: string; priceUsd: number | null; change24hPct: number | null }>
  topCreators: Array<{ rank: number; label: string; score: number }>
} | null> {
  const brief = await buildAlfaClubBriefContext({
    topRows: 3,
    moverRows: 3,
    majorRows: 6,
    compact: true,
    fetchMarkets: true,
  })
  if (!brief.ok) return null
  const topCreators = brief.formatInput.currentRows.slice(0, 3).map((row) => {
    const label =
      brief.formatInput.labels.get(row.creatorAddress.toLowerCase()) ??
      `${row.creatorAddress.slice(0, 6)}…${row.creatorAddress.slice(-4)}`
    return {
      rank: row.rank,
      label: `${label} · #${row.tokenId.toString()}`,
      score: row.score,
    }
  })
  return {
    snapshotTs: brief.snapshotTs,
    previousSnapshotTs: brief.previousSnapshotTs,
    majors: brief.formatInput.marketRows.slice(0, 6),
    topCreators,
  }
}

async function buildMarketCommandReply(): Promise<string> {
  const summary = await buildMarketScopeSummary()
  if (!summary) {
    return 'Market scope is temporarily unavailable. Retry `/market` in a moment.'
  }

  const majorLine = summary.majors
    .map((row) => {
      const px =
        row.priceUsd == null
          ? 'n/a'
          : row.priceUsd >= 1000
            ? `$${row.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            : `$${row.priceUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      const chg =
        row.change24hPct == null
          ? 'n/a'
          : `${row.change24hPct > 0 ? '+' : ''}${row.change24hPct.toFixed(1)}%`
      return `${row.symbol} ${px} (${chg})`
    })
    .join(' · ')

  const topLine = summary.topCreators
    .map((row) => `#${row.rank} ${row.label} (${row.score.toFixed(3)})`)
    .join('\n')

  return [
    '🌐 **Market scope brief**',
    summary.snapshotTs
      ? `Snapshot: ${summary.snapshotTs}${summary.previousSnapshotTs ? ` vs ${summary.previousSnapshotTs}` : ''}`
      : 'Snapshot: latest',
    '',
    `**Majors (24h)** ${majorLine || 'n/a'}`,
    '',
    '**Top AlfaClub creators (snapshot)**',
    topLine || '- No ranked creators available in this snapshot.',
    '',
    'Proactive loop: run `/market` every 15–30m, then `/position` before sizing changes.',
  ].join('\n')
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

  if (command === '/arena') {
    const parsed = parseArenaCommandArgs(args)
    if (!parsed) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: formatArenaUsage(),
      }
    }
    if (!arenaCommandAllowedForRoom(params.roomId ?? null)) {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: 'Arena commands are only enabled in approved rooms.',
      }
    }

    const config = readArenaConfig()
    if (parsed.kind === 'help') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: formatArenaUsage(),
      }
    }
    if (parsed.kind === 'status') {
      const result = await runArenaStatus(config)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok
          ? `Arena status: enabled=${String(result.details?.enabled)} tradingEnabled=${String(result.details?.tradingEnabled)} dryRun=${String(result.details?.dryRun)}`
          : `Arena status unavailable: ${result.message}`,
      }
    }
    if (parsed.kind === 'assets') {
      const result = await listArenaAssets(config)
      if (!result.ok) {
        return { kind: 'hermit', provider: 'local', reply: `Arena assets unavailable: ${result.message}` }
      }
      const assets = Array.isArray(result.details?.assets) ? (result.details?.assets as string[]) : []
      return {
        kind: 'hermit',
        provider: 'local',
        reply: `Arena assets (${assets.length}): ${assets.join(', ')}`,
      }
    }
    if (parsed.kind === 'join') {
      const result = await runArenaJoin(config)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok ? `${result.message}${result.run?.dryRun ? ' [dry-run]' : ''}` : result.message,
      }
    }
    if (parsed.kind === 'activate') {
      const result = await runArenaActivateUnifiedAccount(config)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok ? `${result.message}${result.run?.dryRun ? ' [dry-run]' : ''}` : result.message,
      }
    }
    if (parsed.kind === 'add-api-wallet') {
      const result = await runArenaAddApiWallet(config)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok ? `${result.message}${result.run?.dryRun ? ' [dry-run]' : ''}` : result.message,
      }
    }
    if (parsed.kind === 'deposit') {
      const result = await runArenaDepositUsdc(parsed.amountUsd, config)
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok ? `${result.message}${result.run?.dryRun ? ' [dry-run]' : ''}` : result.message,
      }
    }
    if (parsed.kind === 'trade') {
      const result = await runArenaTrade(
        {
          action: parsed.action,
          pair: parsed.pair,
          ...(parsed.side ? { side: parsed.side } : {}),
          ...(parsed.sizeUsd ? { sizeUsd: parsed.sizeUsd } : {}),
          ...(parsed.leverage ? { leverage: parsed.leverage } : {}),
        },
        config,
      )
      return {
        kind: 'hermit',
        provider: 'local',
        reply: result.ok ? `${result.message}${result.run?.dryRun ? ' [dry-run]' : ''}` : result.message,
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: formatArenaUsage(),
    }
  }

  if (command === '/position') {
    const parsed = parsePositionSubcommand(args)
    if (parsed.kind === 'chart') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: await buildPositionChartCommandReply(params),
      }
    }
    if (parsed.kind === 'markers_all') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: await buildPositionMarkersAllReply(params),
      }
    }
    if (parsed.kind === 'host_markers') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: await buildPositionFilteredChatMarkersReply(params, { kind: 'host' }),
      }
    }
    if (parsed.kind === 'sender_markers') {
      const senderAddress = normalizePositionSenderFilter(parsed.senderToken, params.senderAddress)
      if (!senderAddress) {
        return {
          kind: 'hermit',
          provider: 'local',
          reply:
            'Invalid sender filter. Use `/position sender <0x...>` or `/position sender me`.',
        }
      }
      return {
        kind: 'hermit',
        provider: 'local',
        reply: await buildPositionFilteredChatMarkersReply(params, {
          kind: 'sender',
          senderAddress,
        }),
      }
    }
    if (parsed.kind === 'marker') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: await buildPositionMarkerDetailReply(params, parsed.selector),
      }
    }
    if (parsed.kind === 'usage') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: positionSubcommandUsage(),
      }
    }
    return {
      kind: 'hermit',
      provider: 'local',
      reply: await buildPositionCommandReply(params),
    }
  }

  if (command === '/market') {
    return {
      kind: 'hermit',
      provider: 'local',
      reply: await buildMarketCommandReply(),
    }
  }

  if (command === '/signal') {
    return {
      kind: 'hermit',
      provider: 'local',
      reply: await buildSignalCommandReply(params),
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
      shouldRequestPinataGmeowCaption(args) && readHermitAgentConfig() !== null
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
    const provider = draftedLine ? 'hermit' : 'local'
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
        'Hermit meme path unavailable. Configure HERMIT_AGENT_CHAT_ENDPOINT and HERMIT_AGENT_BEARER_TOKEN.',
      )
    }
    const image = formatHermitImageResult(draft.text)
    const result: HermitExecutionResult = {
      kind: 'meme',
      provider: 'hermit',
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

    // Setup / personalization subcommands run locally — no external Hermit call
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
        'Hermit agent path unavailable. Configure HERMIT_AGENT_CHAT_ENDPOINT and HERMIT_AGENT_BEARER_TOKEN.',
      )
    }
    const result: HermitExecutionResult = {
      kind: 'hermit',
      provider: 'hermit',
      reply: formatHermitReplyFromDraft(draft.text),
    }
    return await withOnboardingNudge(params, result)
  }

  throw commandError(
    'Unsupported Hermit command. Use /gmeow, /hermit [copy|announce|quest|tone], /meme, /position, /signal, /market, or /arena.',
  )
}
