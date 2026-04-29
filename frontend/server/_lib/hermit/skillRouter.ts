import { pickRandomHermitMeme } from './memeStore.js'
import type { HermitExecutionParams, HermitExecutionResult, HermitMediaAttachment } from './types.js'
import WebSocket from 'ws'

declare const process: { env: Record<string, string | undefined> }

type PinataChatResult = {
  text: string
}

type PinataGatewayEvent =
  | { type: 'event'; event?: string; payload?: Record<string, unknown> }
  | { type: 'res'; id?: string; ok?: boolean; payload?: Record<string, unknown>; error?: Record<string, unknown> }

const PINATA_GATEWAY_RPC_TIMEOUT_MS = 30_000

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

  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  })
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

type SpanishDialect =
  | 'neutral_latam'
  | 'mexico'
  | 'argentina'
  | 'colombia'
  | 'chile'
  | 'peru'
  | 'venezuela'
  | 'caribbean'
  | 'spain'

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

function buildSpanishMemoryPersistenceClause(dialect: SpanishDialect | null): string {
  if (dialect !== null) {
    return [
      `Memory persistence (explicit signal): the user just signaled the "${dialect}" Spanish dialect this turn (flag emoji or text hint). BEFORE producing the final JSON output, use your file edit tool to update workspace MEMORY.md so future turns honor it without a flag. Under the "## Preferred dialect" section, in the "Long-term preferences (operator-curated):" list, ensure exactly one bullet of the form:`,
      `- Preferred Spanish dialect: ${dialect} (set by flag/text hint)`,
      'If a "Preferred Spanish dialect:" bullet already exists, replace its dialect value with the new one. If none exists, append the bullet immediately under the "Long-term preferences (operator-curated):" header. Do not duplicate the bullet, do not reorder other entries, and do not rewrite unrelated sections. The explicit signal in this turn overrides any prior memory; the update is so the next turn can use the dialect without a flag. Perform the file edit as a tool action only — do not mention it in your final JSON output.',
    ].join('\n')
  }
  return [
    'Memory persistence (no explicit signal): if you are about to reply in Spanish, FIRST read workspace MEMORY.md. Under "## Preferred dialect" → "Long-term preferences (operator-curated):" look for a bullet "- Preferred Spanish dialect: <dialect>". If one is present and the dialect is one of neutral_latam, mexico, argentina, colombia, chile, peru, venezuela, caribbean, spain, treat that as the active dialect for this turn (apply the matching profile from SPANISH.md, ≈80% clear Spanish / 20% regional flavor, never caricature). If MEMORY.md is absent, unreadable, or has no such bullet, default to neutral_latam. Do not write to MEMORY.md this turn (no explicit signal to record).',
  ].join('\n')
}

function buildHermitLanguageDirective(dialect: SpanishDialect | null): string {
  const effectiveDialect: SpanishDialect = dialect ?? 'neutral_latam'
  const profile = SPANISH_DIALECT_PROFILES[effectiveDialect]
  const dialectExplicit = dialect !== null
  const dialectClause = dialectExplicit
    ? `The user signaled the "${effectiveDialect}" dialect (via flag emoji or text hint). When the language rule selects Spanish, write string values in that dialect. Profile: ${profile} Keep flavor subtle — about 80% clear Spanish, 20% regional flavor. Never lean into caricature or stereotypes.`
    : `Default Spanish dialect is "neutral_latam" unless workspace MEMORY.md records a long-term preference (see persistence note below). Profile: ${profile}`
  return [
    'Language: detect the language of the user input. If the user writes in Spanish or explicitly asks for output en español / in Spanish, set string values in natural Latin American Spanish (see workspace SPANISH.md and MEMORY.md for the style guide; keep crypto-native loanwords like vault, mint, drop, alpha, gm, gas untranslated; address the reader as tú; avoid Castilian forms unless the selected dialect is "spain"). Otherwise reply in English.',
    `Spanish dialect: ${effectiveDialect}. ${dialectClause}`,
    buildSpanishMemoryPersistenceClause(dialect),
    'JSON keys always remain exactly as specified in this prompt — keys are English regardless of language. Hashtags stay as-is. Never wrap the JSON in markdown fences. The final assistant message MUST be ONLY the strict JSON object — any MEMORY.md update must happen as a tool call before the final output, never as prose alongside it.',
  ].join('\n')
}

const HERMIT_LANGUAGE_DIRECTIVE = buildHermitLanguageDirective(null)

function buildPinataPromptForHermit(params: {
  mode: HermitDraftMode
  userPrompt: string
}): string {
  const modeInstruction =
    params.mode === 'announce'
      ? 'Write an announcement style message for a tokenized community room.'
      : params.mode === 'quest'
        ? 'Write quest/reward drop copy with urgency and clear CTA.'
        : params.mode === 'tone'
          ? 'Rewrite input copy into a sharper social tone while preserving meaning.'
          : 'Write concise room copy with social-native energy.'
  const dialect = detectSpanishDialect(params.userPrompt)
  return [
    'You are Hermit, a crypto-native creative assistant for AlfaChat communities.',
    modeInstruction,
    'Output STRICT JSON only (no markdown):',
    '{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}',
    'Rules: line <= 220 chars, alt 2-4 entries, hashtags 1-5, no fabricated claims.',
    buildHermitLanguageDirective(dialect),
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

function buildPinataPromptForHermitImage(userPrompt: string): string {
  const dialect = detectSpanishDialect(userPrompt)
  return [
    'You are Hermit, generating meme-ready image concepts for AlfaChat.',
    'Output STRICT JSON only:',
    '{"imagePrompt":"string","caption":"string","hashtags":["#tag"]}',
    'Rules: imagePrompt vivid and specific, caption <= 180 chars, hashtags 1-5, no markdown.',
    buildHermitLanguageDirective(dialect),
    `User input: ${userPrompt || 'akita doge and a black cat in dark-luxury meme style'}`,
  ].join('\n')
}

function buildPinataPromptForGmeow(params: { userPrompt: string; memeCaption: string; memeTags: string[] }): string {
  const dialect = detectSpanishDialect(params.userPrompt)
  return [
    'You are Hermit crafting one short meme line for AlfaChat.',
    'Output STRICT JSON only:',
    '{"line":"string"}',
    'Rules: line <= 160 chars, playful but clean, no markdown.',
    buildHermitLanguageDirective(dialect),
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

export async function executeHermitCommand(
  params: HermitExecutionParams,
): Promise<HermitExecutionResult> {
  const { command, args } = splitCommandAndArgs(params.commandText)
  if (command === '/gmeow') {
    const meme = pickRandomHermitMeme(args || 'laugh')
    const attachment = inferPublicMediaAttachment(meme.url)
    const localReply = `${meme.caption}\n${meme.url}`
    const draft = await runPinataDraft(
      buildPinataPromptForGmeow({
        userPrompt: args,
        memeCaption: meme.caption,
        memeTags: meme.tags,
      }),
    )
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
    const draft = await runPinataDraft(buildPinataPromptForHermitImage(args))
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
    const draft = await runPinataDraft(
      buildPinataPromptForHermit({
        mode,
        userPrompt: prompt,
      }),
    )
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
