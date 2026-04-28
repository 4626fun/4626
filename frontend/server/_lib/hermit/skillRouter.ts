import { pickRandomHermitMeme } from './memeStore.js'
import type { HermitExecutionParams, HermitExecutionResult } from './types.js'

declare const process: { env: Record<string, string | undefined> }

type PinataChatResult = {
  text: string
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

function readPinataHermitConfig(): { endpoint: string; bearer: string } | null {
  const endpoint = asTrimmed(process.env.HERMIT_PINATA_CHAT_ENDPOINT)
  const bearer = asTrimmed(process.env.HERMIT_PINATA_BEARER_TOKEN)
  if (!endpoint || !bearer) return null
  return { endpoint, bearer }
}

async function runPinataDraft(prompt: string): Promise<PinataChatResult | null> {
  const cfg = readPinataHermitConfig()
  if (!cfg) return null

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
  return [
    'You are Hermit, a crypto-native creative assistant for AlfaChat communities.',
    modeInstruction,
    'Output STRICT JSON only (no markdown):',
    '{"line":"string","alt":["string","string"],"hashtags":["#tag"],"cta":"string"}',
    'Rules: line <= 220 chars, alt 2-4 entries, hashtags 1-5, no fabricated claims.',
    `User input: ${params.userPrompt}`,
  ].join('\n')
}

function buildPinataPromptForHermitImage(userPrompt: string): string {
  return [
    'You are Hermit, generating meme-ready image concepts for AlfaChat.',
    'Output STRICT JSON only:',
    '{"imagePrompt":"string","caption":"string","hashtags":["#tag"]}',
    'Rules: imagePrompt vivid and specific, caption <= 180 chars, hashtags 1-5, no markdown.',
    `User input: ${userPrompt || 'akita doge and a black cat in dark-luxury meme style'}`,
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

export async function executeHermitCommand(
  params: HermitExecutionParams,
): Promise<HermitExecutionResult> {
  const { command, args } = splitCommandAndArgs(params.commandText)
  if (command === '/gmeow') {
    const meme = pickRandomHermitMeme(args)
    return {
      kind: 'gmeow',
      provider: 'local',
      meme,
      reply: `${meme.caption}\n${meme.url}`,
    }
  }

  if (command === '/hermitimg') {
    const draft = await runPinataDraft(buildPinataPromptForHermitImage(args))
    if (!draft?.text) {
      throw commandError(
        'Hermit Pinata image path unavailable. Configure HERMIT_PINATA_CHAT_ENDPOINT and HERMIT_PINATA_BEARER_TOKEN.',
      )
    }
    const image = formatHermitImageResult(draft.text)
    return {
      kind: 'hermitimg',
      provider: 'pinata',
      imagePrompt: image.imagePrompt,
      reply: image.reply,
    }
  }

  if (command === '/hermit') {
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
    'Unsupported Hermit command. Use /gmeow, /hermit [copy|announce|quest|tone], or /hermitimg.',
  )
}
