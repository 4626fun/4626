import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'

import {
  RATE_LIMITS,
  checkRateLimit,
  createCorrelationId,
  getClientIp,
  handleOptions,
  logger,
  rateLimitKey,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { getElizaLlmService } from '../../../server/agent/eliza/llm.js'

export type CreativeMode = 'referral_og' | 'share_page_copy' | 'quest_reward' | 'metadata_bundle'
type CreativeVoice = 'premium_dark_crypto'
type CreativeVersion = 'v1'
type QuestRewardTier = 'base' | 'supporter' | 'boosted' | 'premium'
type QuestRewardStatus = 'locked' | 'unlocked' | 'claimed'
type AssetType = 'og' | 'share_card'
type KeyValuePrimitive = string | number | boolean

const CREATIVE_VERSION: CreativeVersion = 'v1'
const CREATIVE_VOICE: CreativeVoice = 'premium_dark_crypto'
const CREATIVE_AGENT_KEY = 'api-creative'

const creativeModeSchema = z.enum([
  'referral_og',
  'share_page_copy',
  'quest_reward',
  'metadata_bundle',
])

const creativeRequestSchema = z
  .object({
    mode: creativeModeSchema,
    context: z.record(z.string(), z.unknown()).optional(),
    input: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.context != null || value.input != null, {
    message: 'context or input is required',
  })
  .strict()

const referralOgResultSchema = z
  .object({
    headline: z.string().min(1).max(160),
    subheadline: z.string().min(1).max(220),
    cta: z.string().min(1).max(80),
    visual_direction: z.array(z.string().min(1).max(140)).min(2).max(4),
    keywords: z.array(z.string().min(1).max(60)).min(2).max(6),
  })
  .strict()

const sharePageCopyResultSchema = z
  .object({
    title: z.string().min(1).max(120),
    subtitle: z.string().min(1).max(160),
    body_short: z.string().min(1).max(220),
    cta: z.string().min(1).max(80),
  })
  .strict()

const questRewardResultSchema = z
  .object({
    tier: z.enum(['base', 'supporter', 'boosted', 'premium']),
    status: z.enum(['locked', 'unlocked', 'claimed']),
    unlock_message: z.string().min(1).max(220),
    next_step: z.string().min(1).max(220),
  })
  .strict()

const keyValuesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

const metadataBundleResultSchema = z
  .object({
    asset_type: z.enum(['og', 'share_card']),
    title: z.string().min(1).max(120),
    description: z.string().min(1).max(220),
    alt: z.string().min(1).max(220),
    tags: z.array(z.string().min(1).max(60)).min(2).max(8),
    filename_hint: z.string().min(1).max(180),
    pinata_metadata: z
      .object({
        name: z.string().min(1).max(120),
        keyvalues: keyValuesSchema,
      })
      .strict(),
  })
  .strict()

const creativeSuccessEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    mode: creativeModeSchema,
    version: z.literal(CREATIVE_VERSION),
    voice: z.literal(CREATIVE_VOICE),
    result: z.unknown(),
  })
  .strict()

const creativeMissingContextEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    mode: z.union([creativeModeSchema, z.literal('unknown')]),
    version: z.literal(CREATIVE_VERSION),
    error: z.literal('missing_required_context'),
    missing: z.array(z.string().min(1)).min(1),
  })
  .strict()

type ReferralOgResult = z.infer<typeof referralOgResultSchema>
type SharePageCopyResult = z.infer<typeof sharePageCopyResultSchema>
type QuestRewardResult = z.infer<typeof questRewardResultSchema>
type MetadataBundleResult = z.infer<typeof metadataBundleResultSchema>

type CreativeResultByMode = {
  referral_og: ReferralOgResult
  share_page_copy: SharePageCopyResult
  quest_reward: QuestRewardResult
  metadata_bundle: MetadataBundleResult
}

type CreativeSuccessEnvelope<M extends CreativeMode = CreativeMode> = {
  ok: true
  mode: M
  version: CreativeVersion
  voice: CreativeVoice
  result: CreativeResultByMode[M]
}

type MissingContextEnvelope = {
  ok: false
  mode: CreativeMode | 'unknown'
  version: CreativeVersion
  error: 'missing_required_context'
  missing: string[]
}

export type CreativeEnvelope = CreativeSuccessEnvelope | MissingContextEnvelope

const CREATIVE_SYSTEM_PROMPT = `You are the 4626 OG Agent.

You transform app context into deterministic JSON creative outputs for one mode:
- referral_og
- share_page_copy
- metadata_bundle

Hard output contract:
- Return JSON only.
- Top-level keys must be exactly: ok, mode, version, voice, result
- version must be "v1"
- voice must be "premium_dark_crypto"
- mode must match the requested mode
- No wrapper keys like input/output.

Schema by mode:
- referral_og.result: headline, subheadline, cta, visual_direction[], keywords[]
- share_page_copy.result: title, subtitle, body_short, cta
- metadata_bundle.result: asset_type, title, description, alt, tags[], filename_hint, pinata_metadata{name,keyvalues}

If context is incomplete, output:
{
  "ok": false,
  "mode": "<mode>",
  "version": "v1",
  "error": "missing_required_context",
  "missing": ["field"]
}

Style:
- premium, dark luxury, concise, crypto-native
- avoid filler and hype
- never use: moon, 1000x, get rich, don't miss out

Verification language guardrail:
- never use confirmed, verified, validated, proven, claimed, or unlocked unless explicit verification flags exist in context.
`

const QUEST_TIER_PRIORITY: QuestRewardTier[] = ['base', 'supporter', 'boosted', 'premium']
const DISALLOWED_VERIFICATION_WORD = /\b(confirmed|verified|validated|proven|claimed|unlocked)\b/i
const CREATIVE_BODY_MAX_BYTES = 64_000
const CREATIVE_CONTEXT_MAX_BYTES = 24_000
const CREATIVE_CONTEXT_MAX_KEYS = 80

function toStringValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function toNonEmptyLower(value: unknown): string {
  return toStringValue(value).toLowerCase()
}

function toHandle(value: unknown): string {
  const raw = toStringValue(value).replace(/^@+/, '')
  const slug = raw.replace(/[^a-zA-Z0-9_.-]/g, '')
  return slug || 'creator'
}

function toDisplayHandle(value: unknown): string {
  return `@${toHandle(value)}`
}

function toTitleCase(value: string): string {
  const parts = value
    .split(/[\s_-]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  if (parts.length === 0) return 'Creator Vault'
  return parts.join(' ')
}

function toCampaignLabel(value: unknown): string {
  const raw = toStringValue(value)
  if (!raw) return 'Creator Vault'
  return toTitleCase(raw)
}

function toTier(value: unknown, fallback: QuestRewardTier = 'base'): QuestRewardTier {
  const normalized = toNonEmptyLower(value)
  if (QUEST_TIER_PRIORITY.includes(normalized as QuestRewardTier)) {
    return normalized as QuestRewardTier
  }
  return fallback
}

function isBooleanTrue(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }
  return false
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((entry) => toStringValue(entry))
    .map((entry) => entry.toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(normalized))
}

function normalizeShortCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function containsDisallowedVerificationWord(
  value: unknown,
  depth = 0,
  seen: Set<unknown> = new Set(),
): boolean {
  if (depth > 8) return false
  if (typeof value === 'string') {
    return DISALLOWED_VERIFICATION_WORD.test(value)
  }
  if (Array.isArray(value)) {
    return value.some((entry) => containsDisallowedVerificationWord(entry, depth + 1, seen))
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return false
    seen.add(value)
    return Object.values(value).some((entry) => containsDisallowedVerificationWord(entry, depth + 1, seen))
  }
  return false
}

function hasExplicitVerificationSignals(context: Record<string, unknown>): boolean {
  if (toStringList(context.verifiedActions).length > 0) return true

  const booleanVerificationKeys = [
    'verified',
    'isVerified',
    'confirmed',
    'isConfirmed',
    'validated',
    'isValidated',
    'proven',
    'isProven',
    'claimed',
    'isClaimed',
    'rewardClaimed',
    'unlocked',
    'isUnlocked',
  ] as const

  if (booleanVerificationKeys.some((key) => isBooleanTrue(context[key]))) {
    return true
  }

  if (context.verification && typeof context.verification === 'object') {
    const verification = context.verification as Record<string, unknown>
    if (Object.values(verification).some((value) => isBooleanTrue(value))) {
      return true
    }
  }

  return false
}

function violatesVerificationLanguageGuard(params: {
  mode: CreativeMode
  result: unknown
  context: Record<string, unknown>
}): boolean {
  if (params.mode === 'quest_reward') return false
  if (hasExplicitVerificationSignals(params.context)) return false
  return containsDisallowedVerificationWord(params.result)
}

function estimateJsonBytes(value: unknown): number | null {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8')
  } catch {
    return null
  }
}

export function getCreativeContextValidationError(context: Record<string, unknown>): string | null {
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return 'Creative context must be an object'
  }
  const contextKeys = Object.keys(context)
  if (contextKeys.length > CREATIVE_CONTEXT_MAX_KEYS) {
    return `Creative context has too many fields (max ${CREATIVE_CONTEXT_MAX_KEYS})`
  }
  const contextBytes = estimateJsonBytes(context)
  if (contextBytes == null) {
    return 'Creative context could not be serialized'
  }
  if (contextBytes > CREATIVE_CONTEXT_MAX_BYTES) {
    return 'Creative context too large'
  }
  return null
}

function toAssetType(value: unknown): AssetType {
  const normalized = toNonEmptyLower(value)
  return normalized === 'share_card' ? 'share_card' : 'og'
}

function pickMissingFields(mode: CreativeMode, context: Record<string, unknown>): string[] {
  const missing: string[] = []
  const require = (field: string) => {
    const v = context[field]
    if (toStringValue(v).length === 0) missing.push(field)
  }

  switch (mode) {
    case 'referral_og':
      require('handle')
      require('campaign')
      require('tier')
      break
    case 'share_page_copy':
      require('handle')
      break
    case 'quest_reward':
      require('currentTier')
      if (isBooleanTrue(context.targetTierRequired) && toStringValue(context.targetTier).length === 0) {
        missing.push('targetTier')
      }
      break
    case 'metadata_bundle':
      require('asset_type')
      break
    default:
      break
  }
  return missing
}

function buildReferralOgResult(context: Record<string, unknown>): ReferralOgResult {
  const handle = toDisplayHandle(context.handle)
  const tier = toTier(context.tier, 'supporter')
  const campaign = toCampaignLabel(context.campaign)
  return {
    headline: normalizeShortCopy(`${handle} · ${toTitleCase(tier)} Tier Access`),
    subheadline: normalizeShortCopy(`${campaign} creative built for shared upside and premium presentation.`),
    cta: normalizeShortCopy(`Open ${toTitleCase(tier)} Card`),
    visual_direction: [
      'obsidian backdrop with centered light slit and soft metallic bloom',
      `${tier} accent glow with restrained typography and deep contrast`,
    ],
    keywords: ['creator vault', tier],
  }
}

function buildSharePageCopyResult(context: Record<string, unknown>): SharePageCopyResult {
  const handle = toDisplayHandle(context.handle)
  const tier = toTier(context.tier, 'supporter')
  const campaign = toCampaignLabel(context.campaign)
  return {
    title: normalizeShortCopy(`${handle} · ${toTitleCase(tier)} Access`),
    subtitle: normalizeShortCopy(`${campaign} with premium creator-vault framing.`),
    body_short: normalizeShortCopy('Built for aligned holders, cleaner discovery, and long-term shared upside.'),
    cta: 'View Share Page',
  }
}

function buildQuestRewardResult(context: Record<string, unknown>): QuestRewardResult {
  const currentTier = toTier(context.currentTier, 'base')
  const targetTierRaw = toStringValue(context.targetTier)
  const hasTargetTier = targetTierRaw.length > 0
  const targetTier = hasTargetTier ? toTier(targetTierRaw, currentTier) : null
  const tier = targetTier ?? currentTier

  const verifiedActions = toStringList(context.verifiedActions)
  const requiredActions = toStringList(context.requiredActions)
  const missingAction = requiredActions.find((action) => !verifiedActions.includes(action))
  const hasAllRequiredActions = missingAction == null
  const alreadyClaimed = isBooleanTrue(context.claimed) || isBooleanTrue(context.rewardClaimed)

  let status: QuestRewardStatus
  if (tier === currentTier) {
    status = alreadyClaimed ? 'claimed' : 'unlocked'
  } else if (alreadyClaimed) {
    status = 'claimed'
  } else {
    status = hasAllRequiredActions ? 'unlocked' : 'locked'
  }

  let unlockMessage = ''
  let nextStep = ''
  if (status === 'locked') {
    unlockMessage = `Finish the remaining quest actions to reach ${toTitleCase(tier)} tier.`
    nextStep = missingAction
      ? `Complete ${missingAction} and check tier progress again.`
      : `Complete required actions and check tier progress again.`
  } else if (status === 'claimed') {
    unlockMessage = `${toTitleCase(tier)} reward is already recorded for this account.`
    nextStep = 'Move to the next tier target when ready.'
  } else if (tier === currentTier) {
    unlockMessage = `${toTitleCase(tier)} tier is active and ready to use.`
    nextStep = missingAction
      ? `Complete ${missingAction} to progress toward the next tier.`
      : `Use this tier across referral and share assets.`
  } else {
    unlockMessage = `${toTitleCase(tier)} tier is ready to activate.`
    nextStep = 'Use this upgraded tier on referral cards and share surfaces.'
  }

  return {
    tier,
    status,
    unlock_message: normalizeShortCopy(unlockMessage),
    next_step: normalizeShortCopy(nextStep),
  }
}

function sanitizeKeyValuePrimitive(value: unknown): KeyValuePrimitive {
  if (typeof value === 'string') return normalizeShortCopy(value)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'boolean') return value
  return normalizeShortCopy(String(value ?? ''))
}

function buildMetadataBundleResult(context: Record<string, unknown>): MetadataBundleResult {
  const handle = toHandle(context.handle)
  const displayHandle = `@${handle}`
  const campaign = toCampaignLabel(context.campaign)
  const tier = toTier(context.tier, 'supporter')
  const assetType = toAssetType(context.asset_type)
  const tagsFromContext = Array.isArray(context.tags)
    ? context.tags.map((entry) => normalizeShortCopy(toStringValue(entry))).filter(Boolean)
    : []
  const tags = Array.from(
    new Set([
      ...tagsFromContext,
      '4626',
      'creator-vault',
      tier,
      assetType === 'share_card' ? 'share-card' : 'og',
    ]),
  ).slice(0, 8)
  while (tags.length < 2) tags.push('creator-vault')

  const filenameHintBase = `${handle}-${campaign.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${tier}-${assetType}`
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const keyvaluesFromContext =
    context.pinata_metadata &&
    typeof context.pinata_metadata === 'object' &&
    (context.pinata_metadata as Record<string, unknown>).keyvalues &&
    typeof (context.pinata_metadata as Record<string, unknown>).keyvalues === 'object'
      ? ((context.pinata_metadata as Record<string, unknown>).keyvalues as Record<string, unknown>)
      : {}

  const keyvalues = Object.fromEntries(
    Object.entries({
      mode: 'metadata_bundle',
      campaign: campaign.toLowerCase().replace(/\s+/g, '-'),
      handle,
      tier,
      asset_type: assetType,
      ...keyvaluesFromContext,
    }).map(([key, value]) => [key, sanitizeKeyValuePrimitive(value)]),
  )

  return {
    asset_type: assetType,
    title:
      normalizeShortCopy(toStringValue(context.title)) ||
      `${displayHandle} · ${toTitleCase(tier)} ${assetType === 'share_card' ? 'Share Card' : 'OG Card'}`,
    description:
      normalizeShortCopy(toStringValue(context.description)) ||
      `${campaign} creative for ${displayHandle} at ${toTitleCase(tier)} tier.`,
    alt:
      normalizeShortCopy(toStringValue(context.alt)) ||
      `Dark luxury ${assetType === 'share_card' ? 'share card' : 'OG image'} for ${displayHandle}.`,
    tags,
    filename_hint: normalizeShortCopy(toStringValue(context.filename_hint)) || `${filenameHintBase}.png`,
    pinata_metadata: {
      name:
        normalizeShortCopy(
          context.pinata_metadata && typeof context.pinata_metadata === 'object'
            ? toStringValue((context.pinata_metadata as Record<string, unknown>).name)
            : '',
        ) || `${displayHandle} ${assetType}`,
      keyvalues,
    },
  }
}

function buildDeterministicEnvelope<M extends CreativeMode>(
  mode: M,
  context: Record<string, unknown>,
): CreativeSuccessEnvelope<M> {
  const result =
    mode === 'referral_og'
      ? buildReferralOgResult(context)
      : mode === 'share_page_copy'
        ? buildSharePageCopyResult(context)
        : mode === 'quest_reward'
          ? buildQuestRewardResult(context)
          : buildMetadataBundleResult(context)

  return {
    ok: true,
    mode,
    version: CREATIVE_VERSION,
    voice: CREATIVE_VOICE,
    result: result as CreativeResultByMode[M],
  }
}

function buildMissingContextEnvelope(mode: CreativeMode, missing: string[]): MissingContextEnvelope {
  return {
    ok: false,
    mode,
    version: CREATIVE_VERSION,
    error: 'missing_required_context',
    missing,
  }
}

function validateCreativeEnvelope(envelope: CreativeEnvelope): CreativeEnvelope {
  if (envelope.ok) {
    const parsed = parseAndValidateCreativeEnvelope(envelope.mode, envelope)
    if (!parsed) {
      throw new Error('Failed to validate creative success envelope')
    }
    return parsed
  }
  const parsed = creativeMissingContextEnvelopeSchema.safeParse(envelope)
  if (!parsed.success) {
    throw new Error('Failed to validate creative missing-context envelope')
  }
  return parsed.data
}

function parseJsonLike(raw: string): unknown | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const tryParse = (input: string): unknown | null => {
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  const direct = tryParse(trimmed)
  if (direct != null) return direct

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim())
    if (parsed != null) return parsed
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(trimmed.slice(firstBrace, lastBrace + 1))
  }

  return null
}

function parseAndValidateCreativeEnvelope<M extends CreativeMode>(
  mode: M,
  candidate: unknown,
): CreativeSuccessEnvelope<M> | null {
  const base = creativeSuccessEnvelopeSchema.safeParse(candidate)
  if (!base.success) return null
  if (base.data.mode !== mode) return null

  if (mode === 'referral_og') {
    const parsedResult = referralOgResultSchema.safeParse(base.data.result)
    if (!parsedResult.success) return null
    return { ...base.data, result: parsedResult.data } as CreativeSuccessEnvelope<M>
  }

  if (mode === 'share_page_copy') {
    const parsedResult = sharePageCopyResultSchema.safeParse(base.data.result)
    if (!parsedResult.success) return null
    return { ...base.data, result: parsedResult.data } as CreativeSuccessEnvelope<M>
  }

  if (mode === 'quest_reward') {
    const parsedResult = questRewardResultSchema.safeParse(base.data.result)
    if (!parsedResult.success) return null
    return { ...base.data, result: parsedResult.data } as CreativeSuccessEnvelope<M>
  }

  const parsedResult = metadataBundleResultSchema.safeParse(base.data.result)
  if (!parsedResult.success) return null
  return { ...base.data, result: parsedResult.data } as CreativeSuccessEnvelope<M>
}

function shouldAttemptLlm(mode: CreativeMode): boolean {
  if (mode === 'quest_reward') return false
  const normalized = String(process.env.AGENT_CREATIVE_ENABLE_LLM ?? '1').trim().toLowerCase()
  if (!normalized) return true
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

async function maybeGenerateWithLlm<M extends CreativeMode>(params: {
  mode: M
  context: Record<string, unknown>
  baseline: CreativeSuccessEnvelope<M>
  correlationId: string
}): Promise<CreativeSuccessEnvelope<M> | null> {
  const llm = getElizaLlmService()
  const llmResult = await llm.generateResponse({
    agentKey: CREATIVE_AGENT_KEY,
    userMessage: JSON.stringify(
      {
        mode: params.mode,
        context: params.context,
        baseline: params.baseline,
      },
      null,
      2,
    ),
    systemPrompt: CREATIVE_SYSTEM_PROMPT,
    vaultContext: '',
    correlationId: params.correlationId,
  })
  const raw = toStringValue(llmResult.text)
  if (!raw) return null
  const parsed = parseJsonLike(raw)
  if (parsed == null) return null
  const validated = parseAndValidateCreativeEnvelope(params.mode, parsed)
  if (!validated) return null
  if (
    violatesVerificationLanguageGuard({
      mode: params.mode,
      result: validated.result,
      context: params.context,
    })
  ) {
    return null
  }
  return validated
}

export async function generateCreativeEnvelope(params: {
  mode: CreativeMode
  context: Record<string, unknown>
  allowLlm?: boolean
  correlationId?: string
}): Promise<CreativeEnvelope> {
  const mode = params.mode
  const context = params.context
  const missing = pickMissingFields(mode, context)
  if (missing.length > 0) {
    return validateCreativeEnvelope(buildMissingContextEnvelope(mode, missing))
  }

  const deterministic = buildDeterministicEnvelope(mode, context)
  const allowLlm = params.allowLlm ?? shouldAttemptLlm(mode)
  if (!allowLlm) {
    return validateCreativeEnvelope(deterministic)
  }

  const correlationId = params.correlationId ?? createCorrelationId('creative')
  try {
    const llmEnvelope = await maybeGenerateWithLlm({
      mode,
      context,
      baseline: deterministic,
      correlationId,
    })
    if (llmEnvelope) {
      return validateCreativeEnvelope(llmEnvelope)
    }
  } catch (error) {
    logger.warn('[api/agent/creative] llm fallback to deterministic response', {
      correlationId,
      mode,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return validateCreativeEnvelope(deterministic)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const clientIp = getClientIp(req)
  const rate = checkRateLimit(rateLimitKey('agent-creative', clientIp), RATE_LIMITS.agentCreative)
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMITS.agentCreative.maxRequests))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rate.remaining)))
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rate.resetAt / 1000)))
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const rawBody = await readJsonBody<Record<string, unknown>>(req, { maxBytes: CREATIVE_BODY_MAX_BYTES })
  if (rawBody == null) {
    return res.status(400).json({ success: false, error: 'Invalid request body' })
  }
  const parsedBody = creativeRequestSchema.safeParse(rawBody)
  if (!parsedBody.success) {
    return res.status(400).json({ success: false, error: 'Invalid request body' })
  }

  const mode = parsedBody.data.mode
  const context = (parsedBody.data.context ?? parsedBody.data.input ?? {}) as Record<string, unknown>
  const contextValidationError = getCreativeContextValidationError(context)
  if (contextValidationError) {
    const statusCode = contextValidationError === 'Creative context too large' ? 413 : 400
    return res.status(statusCode).json({ success: false, error: contextValidationError })
  }

  try {
    const envelope = await generateCreativeEnvelope({ mode, context })
    return res.status(200).json(envelope)
  } catch (error) {
    logger.error('[api/agent/creative] failed to generate creative envelope', {
      error: error instanceof Error ? error.message : String(error),
    })
    return res.status(500).json({ success: false, error: 'Failed to generate creative response' })
  }
}
