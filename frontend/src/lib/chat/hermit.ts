import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type HermitCommandKind = 'gmeow' | 'hermit' | 'hermitimg'
export type HermitProvider = 'local' | 'pinata'

export type HermitMeme = {
  id: string
  url: string
  caption: string
  tags: string[]
}

export type HermitResult = {
  kind: HermitCommandKind
  provider: HermitProvider
  reply: string
  meme?: HermitMeme
  imagePrompt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isHermitMeme(value: unknown): value is HermitMeme {
  if (!isRecord(value)) return false
  if (!hasOnlyKeys(value, ['id', 'url', 'caption', 'tags'])) return false
  return (
    typeof value.id === 'string' &&
    typeof value.url === 'string' &&
    typeof value.caption === 'string' &&
    isStringArray(value.tags)
  )
}

function isHermitResult(value: unknown): value is HermitResult {
  if (!isRecord(value)) return false
  if (!hasOnlyKeys(value, ['kind', 'provider', 'reply', 'meme', 'imagePrompt'])) return false
  if (!(value.kind === 'gmeow' || value.kind === 'hermit' || value.kind === 'hermitimg')) return false
  if (!(value.provider === 'local' || value.provider === 'pinata')) return false
  if (typeof value.reply !== 'string') return false
  if (typeof value.imagePrompt !== 'undefined' && typeof value.imagePrompt !== 'string') return false
  if (typeof value.meme !== 'undefined' && !isHermitMeme(value.meme)) return false
  return true
}

function parseHermitResult(payload: unknown): HermitResult {
  if (!isRecord(payload)) throw new Error('Hermit response was not a JSON object')
  if (payload.success !== true) throw new Error('Hermit response was not successful')
  if (!('data' in payload)) throw new Error('Hermit response missing data')
  if (!isHermitResult(payload.data)) throw new Error('Hermit response data shape was invalid')
  return payload.data
}

export async function runHermitCommand(command: string): Promise<HermitResult> {
  const response = await apiFetch(API_ENDPOINTS.chat.hermit, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'hermit',
      command,
    }),
    withCredentials: true,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Hermit request failed (${response.status})`))
  }

  return parseHermitResult(payload)
}
