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
import { pickRandomHermitMeme } from './memeStore.js'
import type {
  HermitExecutionParams,
  HermitExecutionResult,
  HermitMediaAttachment,
  HermitUserPreferences,
} from './types.js'
import WebSocket from 'ws'

declare const process: { env: Record<string, string | undefined> }

type PinataChatResult = {
  text: string
}

type PinataGatewayEvent =
  | { type: 'event'; event?: string; payload?: Record<string, unknown> }
  | { type: 'res'; id?: string; ok?: boolean; payload?: Record<string, unknown>; error?: Record<string, unknown> }

const PINATA_GATEWAY_RPC_TIMEOUT_MS = 30_000
const PINATA_HTTP_FALLBACK_TIMEOUT_MS_DEFAULT = 30_000

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

  const filename = hintedFilename || pathname.split('/').filter(Boolean).pop()
  const mediaName = filename || pathname
  if (hostname === 'media.tenor.com' && mediaName.endsWith('.gif')) {
    return { url: trimmed, type: 'tenor-gif' }
  }
  if (mediaName.endsWith('.jpg') || mediaName.endsWith('.jpeg')) {
    return {
      url: trimmed,
      type: 'photo',
      ...(filename ? { filename } : {}),
      mime_type: 'image/jpeg',
    }
  }
  if (mediaName.endsWith('.png')) {
    return {
      url: trimmed,
      type: 'photo',
      ...(filename ? { filename } : {}),
      mime_type: 'image/png',
    }
  }
  if (mediaName.endsWith('.webp')) {
    return {
      url: trimmed,
      type: 'photo',
      ...(filename ? { filename } : {}),
      mime_type: 'image/webp',
    }
  }
  return null
}

function readPinataHermitConfig(): { endpoint: string; bearer: string } | null {
  const endpoint = asTrimmed(process.env.HERMIT_PINATA_CHAT_ENDPOINT)
  const bearer = asTrimmed(process.env.HERMIT_PINATA_BEARER_TOKEN)
  if (!endpoint || !bearer) return null
  return { endpoint, bearer }
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
  return joined || null
}

async function runPinataDraftOverGateway(params: {
  endpoint: string
  bearer: string
  prompt: string
}): Promise<PinataChatResult | null> {
  const gateway = toGatewaySocketUrl(params.endpoint)
  if (!gateway) return null

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
          mode: 'webchat',
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

    const timeout = setTimeout(() => finish(null), PINATA_GATEWAY_RPC_TIMEOUT_MS)

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
          sessionKey: 'main',
          message: params.prompt,
          deliver: false,
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

async function runPinataDraft(prompt: string): Promise<PinataChatResult | null> {
  const cfg = readPinataHermitConfig()
  if (!cfg) return null

  const gatewayTarget = toGatewaySocketUrl(cfg.endpoint)
  if (gatewayTarget) {
    const viaGateway = await runPinataDraftOverGateway({
      endpoint: cfg.endpoint,
      bearer: cfg.bearer,
      prompt,
    })
    return viaGateway?.text ? viaGateway : null
  }

  // HTTP fallback path. Bound by `HERMIT_PINATA_HTTP_TIMEOUT_MS` so a hung
  // creative backend cannot stall the AlfaClub chat-bridge tick or leave a
  // /hermit serverless invocation running until Vercel kills it. On timeout
  // or any non-2xx, returns null and the caller surfaces a fallback reply.
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), readPinataHttpTimeoutMs())
  let res: Response
  try {
    res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
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

function buildPinataPromptForHermit(params: {
  mode: HermitDraftMode
  userPrompt: string
  userPreferences?: HermitUserPreferences | null
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
  return [
    'You are Hermit, a crypto-native creative assistant for AlfaChat communities.',
    modeInstruction,
    'Output STRICT JSON only (no markdown):',
    '{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}',
    'Rules: line <= 220 chars, alt 2-4 entries, hashtags 1-5, no fabricated claims.',
    buildHermitLanguageDirective(dialect, source),
    `User input: ${params.userPrompt}`,
  ].join('\n')
}

function buildHermitHelpReply(): string {
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
  ].join('\n')
}

function buildPinataPromptForHermitImage(
  userPrompt: string,
  userPreferences?: HermitUserPreferences | null,
): string {
  const { dialect, source } = resolveActiveDialect({ userPrompt, userPreferences })
  return [
    'You are Hermit, generating meme-ready image concepts for AlfaChat.',
    'Output STRICT JSON only:',
    '{"imagePrompt":"string","caption":"string","hashtags":["#tag"]}',
    'Rules: imagePrompt vivid and specific, caption <= 180 chars, hashtags 1-5, no markdown.',
    buildHermitLanguageDirective(dialect, source),
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
  return [
    'You are Hermit crafting one short meme line for AlfaChat.',
    'Output STRICT JSON only:',
    '{"line":"string"}',
    'Rules: line <= 160 chars, playful but clean, no markdown.',
    buildHermitLanguageDirective(dialect, source),
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

function formatHermitImageResult(rawText: string): { imagePrompt: string; reply: string } {
  const parsed = parseLooseJsonObject(rawText)
  if (!parsed) {
    const fallback = rawText.trim()
    return { imagePrompt: fallback, reply: fallback }
  }
  const imagePrompt = asString(parsed.imagePrompt)
  const caption = asString(parsed.caption)
  const hashtags = asStringArray(parsed.hashtags, 5)

  const replyParts: string[] = []
  if (imagePrompt) replyParts.push(`Prompt: ${imagePrompt}`)
  if (caption) replyParts.push(`Caption: ${caption}`)
  if (hashtags.length > 0) replyParts.push(hashtags.join(' '))
  const reply = replyParts.join('\n').trim() || rawText.trim()
  return { imagePrompt: imagePrompt || rawText.trim(), reply }
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

export async function executeHermitCommand(
  params: HermitExecutionParams,
): Promise<HermitExecutionResult> {
  const { command, args } = splitCommandAndArgs(params.commandText)
  const userPreferences: HermitUserPreferences | null = params.userPreferences ?? null

  if (command === '/gmeow') {
    const meme = pickRandomHermitMeme(args || 'laugh')
    const attachment = inferPublicMediaAttachment(meme.url)
    const localReply = `${meme.caption}\n${meme.url}`
    const explicitSignalSource = classifyExplicitSignal(args)
    const draft = await runPinataDraft(
      buildPinataPromptForGmeow({
        userPrompt: args,
        memeCaption: meme.caption,
        memeTags: meme.tags,
        userPreferences,
      }),
    )
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, args, explicitSignalSource)
    }
    const parsed = draft?.text ? parseLooseJsonObject(draft.text) : null
    const draftedLine =
      asString(parsed?.line) || asString(parsed?.caption) || asString(parsed?.text) || asString(draft?.text)
    const reply = draftedLine ? `${draftedLine}\n${meme.url}` : localReply
    return {
      kind: 'gmeow',
      provider: draftedLine ? 'pinata' : 'local',
      meme,
      reply,
      ...(attachment ? { mediaAttachments: [attachment] } : {}),
    }
  }

  if (command === '/meme') {
    const explicitSignalSource = classifyExplicitSignal(args)
    const draft = await runPinataDraft(buildPinataPromptForHermitImage(args, userPreferences))
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, args, explicitSignalSource)
    }
    if (!draft?.text) {
      throw commandError(
        'Hermit meme path unavailable. Configure HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN.',
      )
    }
    const image = formatHermitImageResult(draft.text)
    return {
      kind: 'meme',
      provider: 'pinata',
      imagePrompt: image.imagePrompt,
      reply: image.reply,
    }
  }

  if (command === '/hermit') {
    if (!args || args.toLowerCase() === 'help') {
      return {
        kind: 'hermit',
        provider: 'local',
        reply: buildHermitHelpReply(),
      }
    }
    const { mode, prompt } = parseHermitDraftMode(args)
    const explicitSignalSource = classifyExplicitSignal(prompt)
    const draft = await runPinataDraft(
      buildPinataPromptForHermit({
        mode,
        userPrompt: prompt,
        userPreferences,
      }),
    )
    if (explicitSignalSource) {
      await persistExplicitDialectSignal(params, prompt, explicitSignalSource)
    }
    if (!draft?.text) {
      throw commandError(
        'Hermit Pinata path unavailable. Configure HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN.',
      )
    }
    return {
      kind: 'hermit',
      provider: 'pinata',
      reply: formatHermitReplyFromDraft(draft.text),
    }
  }

  throw commandError(
    'Unsupported Hermit command. Use /gmeow, /hermit [copy|announce|quest|tone], or /meme.',
  )
}
