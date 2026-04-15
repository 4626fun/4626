import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type CreativeMode = 'referral_og' | 'share_page_copy' | 'quest_reward' | 'metadata_bundle'
export type CreativeVersion = 'v1'
export type CreativeVoice = 'premium_dark_crypto'

export type ReferralOgResult = {
  headline: string
  subheadline: string
  cta: string
  visual_direction: string[]
  keywords: string[]
}

export type SharePageCopyResult = {
  title: string
  subtitle: string
  body_short: string
  cta: string
}

export type QuestRewardResult = {
  tier: 'base' | 'supporter' | 'boosted' | 'premium'
  status: 'locked' | 'unlocked' | 'claimed'
  unlock_message: string
  next_step: string
}

export type MetadataBundleResult = {
  asset_type: 'og' | 'share_card'
  title: string
  description: string
  alt: string
  tags: string[]
  filename_hint: string
  pinata_metadata: {
    name: string
    keyvalues: Record<string, string | number | boolean>
  }
}

type CreativeResultByMode = {
  referral_og: ReferralOgResult
  share_page_copy: SharePageCopyResult
  quest_reward: QuestRewardResult
  metadata_bundle: MetadataBundleResult
}

export type CreativeSuccessEnvelope<M extends CreativeMode = CreativeMode> = {
  ok: true
  mode: M
  version: CreativeVersion
  voice: CreativeVoice
  result: CreativeResultByMode[M]
}

export type CreativeMissingContextEnvelope = {
  ok: false
  mode: CreativeMode | 'unknown'
  version: CreativeVersion
  error: 'missing_required_context'
  missing: string[]
}

export type CreativeEnvelope = CreativeSuccessEnvelope | CreativeMissingContextEnvelope

export type ReferralOgEnvelope = CreativeSuccessEnvelope<'referral_og'>
export type SharePageCopyEnvelope = CreativeSuccessEnvelope<'share_page_copy'>
export type QuestRewardEnvelope = CreativeSuccessEnvelope<'quest_reward'>
export type MetadataBundleEnvelope = CreativeSuccessEnvelope<'metadata_bundle'>

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isStringArray(value: unknown, opts: { min?: number; max?: number } = {}): value is string[] {
  if (!Array.isArray(value)) return false
  if (typeof opts.min === 'number' && value.length < opts.min) return false
  if (typeof opts.max === 'number' && value.length > opts.max) return false
  return value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isReferralOgResult(value: unknown): value is ReferralOgResult {
  if (!isRecord(value)) return false
  if (!hasOnlyKeys(value, ['headline', 'subheadline', 'cta', 'visual_direction', 'keywords'])) return false
  return (
    typeof value.headline === 'string' &&
    typeof value.subheadline === 'string' &&
    typeof value.cta === 'string' &&
    isStringArray(value.visual_direction, { min: 2, max: 4 }) &&
    isStringArray(value.keywords, { min: 2, max: 6 })
  )
}

function isSharePageCopyResult(value: unknown): value is SharePageCopyResult {
  if (!isRecord(value)) return false
  if (!hasOnlyKeys(value, ['title', 'subtitle', 'body_short', 'cta'])) return false
  return (
    typeof value.title === 'string' &&
    typeof value.subtitle === 'string' &&
    typeof value.body_short === 'string' &&
    typeof value.cta === 'string'
  )
}

function isQuestRewardResult(value: unknown): value is QuestRewardResult {
  if (!isRecord(value)) return false
  if (!hasOnlyKeys(value, ['tier', 'status', 'unlock_message', 'next_step'])) return false
  return (
    (value.tier === 'base' || value.tier === 'supporter' || value.tier === 'boosted' || value.tier === 'premium') &&
    (value.status === 'locked' || value.status === 'unlocked' || value.status === 'claimed') &&
    typeof value.unlock_message === 'string' &&
    typeof value.next_step === 'string'
  )
}

function isMetadataBundleResult(value: unknown): value is MetadataBundleResult {
  if (!isRecord(value)) return false
  if (
    !hasOnlyKeys(value, [
      'asset_type',
      'title',
      'description',
      'alt',
      'tags',
      'filename_hint',
      'pinata_metadata',
    ])
  ) {
    return false
  }
  if (!(value.asset_type === 'og' || value.asset_type === 'share_card')) return false
  if (
    typeof value.title !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.alt !== 'string' ||
    typeof value.filename_hint !== 'string'
  ) {
    return false
  }
  if (!isStringArray(value.tags, { min: 2, max: 8 })) return false
  if (!isRecord(value.pinata_metadata)) return false
  if (!hasOnlyKeys(value.pinata_metadata, ['name', 'keyvalues'])) return false
  if (typeof value.pinata_metadata.name !== 'string') return false
  if (!isRecord(value.pinata_metadata.keyvalues)) return false
  return Object.values(value.pinata_metadata.keyvalues).every(
    (entry) => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean',
  )
}

function isCreativeMode(value: unknown): value is CreativeMode {
  return (
    value === 'referral_og' ||
    value === 'share_page_copy' ||
    value === 'quest_reward' ||
    value === 'metadata_bundle'
  )
}

function parseCreativeEnvelope(payload: unknown): CreativeEnvelope {
  if (!isRecord(payload)) {
    throw new Error('Creative response was not a JSON object')
  }

  if (payload.ok === true) {
    if (!hasOnlyKeys(payload, ['ok', 'mode', 'version', 'voice', 'result'])) {
      throw new Error('Creative response envelope contained unexpected fields')
    }
    if (!isCreativeMode(payload.mode)) {
      throw new Error('Creative response mode was invalid')
    }
    if (payload.version !== 'v1') {
      throw new Error('Creative response version was invalid')
    }
    if (payload.voice !== 'premium_dark_crypto') {
      throw new Error('Creative response voice was invalid')
    }
    if (!isRecord(payload.result)) {
      throw new Error('Creative response result was invalid')
    }
    const resultMatchesMode =
      (payload.mode === 'referral_og' && isReferralOgResult(payload.result)) ||
      (payload.mode === 'share_page_copy' && isSharePageCopyResult(payload.result)) ||
      (payload.mode === 'quest_reward' && isQuestRewardResult(payload.result)) ||
      (payload.mode === 'metadata_bundle' && isMetadataBundleResult(payload.result))
    if (!resultMatchesMode) {
      throw new Error('Creative response result did not match mode schema')
    }
    return payload as CreativeSuccessEnvelope
  }

  if (payload.ok === false) {
    if (!hasOnlyKeys(payload, ['ok', 'mode', 'version', 'error', 'missing'])) {
      throw new Error('Creative error response envelope contained unexpected fields')
    }
    if (!(isCreativeMode(payload.mode) || payload.mode === 'unknown')) {
      throw new Error('Creative error response mode was invalid')
    }
    if (payload.version !== 'v1') {
      throw new Error('Creative error response version was invalid')
    }
    if (payload.error !== 'missing_required_context') {
      throw new Error('Creative error response type was invalid')
    }
    if (!Array.isArray(payload.missing) || payload.missing.some((entry) => typeof entry !== 'string' || !entry.trim())) {
      throw new Error('Creative error response missing list was invalid')
    }
    return payload as CreativeMissingContextEnvelope
  }

  throw new Error('Creative response shape was invalid')
}

export async function generateAgentCreative(params: {
  mode: CreativeMode
  context: Record<string, unknown>
}): Promise<CreativeEnvelope> {
  const response = await apiFetch(API_ENDPOINTS.agent.creative, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: params.mode,
      context: params.context,
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Creative request failed (${response.status})`))
  }
  return parseCreativeEnvelope(payload)
}

export function isReferralOgEnvelope(envelope: CreativeEnvelope): envelope is ReferralOgEnvelope {
  return envelope.ok === true && envelope.mode === 'referral_og'
}
