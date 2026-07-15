import { createHash } from 'node:crypto'

import {
  claimOpinionIntent,
  OpinionTradeStoreError,
  transitionOpinionDecision,
  type DecisionTerminalOutcome,
  type OpinionTradeDecision,
} from './inverseOpinionTradeStore.js'

const MAX_SOURCE_EXCERPT_CHARS = 280

export type InverseOpinionParseMode = 'strict' | 'qualified' | 'mention' | 'loose'

export type RecordableInverseOpinionIntent = {
  id: string
  date: number
  sender: string
  publicAuthorLabel?: string | null
  text: string
  userSide: 'long' | 'short'
  pair: string
  ordinal?: number
  parseMode?: InverseOpinionParseMode
}

function sourceTimestamp(date: number): string {
  const numeric = Number(date)
  if (!Number.isFinite(numeric) || numeric <= 0) return new Date().toISOString()
  const milliseconds = numeric < 10_000_000_000 ? numeric * 1_000 : numeric
  const parsed = new Date(milliseconds)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString()
}

function boundedExcerpt(text: string): string {
  const normalized = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= MAX_SOURCE_EXCERPT_CHARS) return normalized
  return `${normalized.slice(0, MAX_SOURCE_EXCERPT_CHARS - 1).trimEnd()}…`
}

function normalizePublicLabel(label: string | null | undefined): string | null {
  const normalized = String(label ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized || normalized.length > 120) return null
  return normalized
}

export function shortenOpinionAuthorWallet(wallet: string): string {
  const normalized = String(wallet ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return 'unknown'
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`
}

/**
 * U1's normalized-market vocabulary is chain-neutral and excludes `:`.
 * Preserve HIP-3 namespace identity deterministically with `DEX.PAIR`; the
 * exact Arena pair remains in submitted requested parameters.
 */
export function normalizeOpinionTradeStorageMarket(pair: string): string {
  return String(pair ?? '').trim().replace(/:/g, '.').toUpperCase()
}

export async function claimInverseOpinionTradeIntent(params: {
  roomId: string
  intent: RecordableInverseOpinionIntent
}): Promise<OpinionTradeDecision> {
  const text = String(params.intent.text ?? '')
  const sender = String(params.intent.sender ?? '').trim().toLowerCase()
  const explicitLabel = normalizePublicLabel(params.intent.publicAuthorLabel)
  return claimOpinionIntent({
    source: {
      roomId: String(params.roomId ?? '').trim(),
      messageId: String(params.intent.id ?? '').trim(),
      sourceHash: createHash('sha256').update(text, 'utf8').digest('hex'),
      excerpt: boundedExcerpt(text),
      senderAddress: sender,
      publicAuthorLabel: explicitLabel ?? shortenOpinionAuthorWallet(sender),
      sourceTimestamp: sourceTimestamp(params.intent.date),
    },
    intent: {
      ordinal: params.intent.ordinal ?? 0,
      normalizedMarket: normalizeOpinionTradeStorageMarket(params.intent.pair),
      sourceSide: params.intent.userSide,
      inverseSide: params.intent.userSide === 'long' ? 'short' : 'long',
      attributionQuality: 'complete',
    },
  })
}

export async function recordInverseOpinionTradeSubmitted(params: {
  decision: OpinionTradeDecision
  executorWallet: string
  requestedParameters: Record<string, unknown>
  parseMode: InverseOpinionParseMode
}): Promise<boolean> {
  try {
    await transitionOpinionDecision({
      decisionId: params.decision.decisionId,
      executionPhase: 'submitted',
      executionClaimToken: params.decision.executionClaimToken,
      executorWallet: params.executorWallet,
      requestedParameters: {
        ...params.requestedParameters,
        parseMode: params.parseMode,
      },
    })
    return true
  } catch (error) {
    if (error instanceof OpinionTradeStoreError && error.code === 'invalid_transition') {
      return false
    }
    throw error
  }
}

export async function recordInverseOpinionTradeTerminal(params: {
  decision: OpinionTradeDecision
  outcome: DecisionTerminalOutcome
  reasonCode: string
  receiptSummary?: Record<string, unknown>
}): Promise<void> {
  await transitionOpinionDecision({
    decisionId: params.decision.decisionId,
    executionPhase: 'resolved',
    terminalOutcome: params.outcome,
    reasonCode: params.reasonCode,
    ...(
      params.outcome === 'rejected' || params.outcome === 'blocked'
        ? { executionClaimToken: params.decision.executionClaimToken }
        : {}
    ),
    receiptSummary: params.receiptSummary,
  })
}

export async function recordInverseOpinionTradeUnknown(params: {
  decision: OpinionTradeDecision
  reasonCode: string
  receiptSummary?: Record<string, unknown>
}): Promise<void> {
  await transitionOpinionDecision({
    decisionId: params.decision.decisionId,
    executionPhase: 'unknown',
    reasonCode: params.reasonCode,
    receiptSummary: params.receiptSummary,
  })
}
