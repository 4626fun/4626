/**
 * AlfaClub Integrity Scorecard builder.
 *
 * Produces a strictly-factual JSON document that can be uploaded to Lens
 * Grove as an immutable artifact and referenced by Lens posts and
 * ERC-8004 `giveFeedback` payloads.
 *
 * Content rules (defamation-safe):
 *   - Only numeric onchain facts (FriendKey supply, FriendStake stake,
 *     Hyperliquid PnL) — no adjectives, no editorial claims.
 *   - Every metric carries the exact snapshot timestamp.
 *   - Each scorecard embeds the same disclaimer so downstream viewers
 *     can tell our ranking apart from AlfaClub's in-app ranking.
 */

import { keccak256, toHex } from 'viem'

import { tryUploadImmutableJson, type GroveUploadAttempt } from '../lens/lensGrove.js'
import type { RankedCreator } from './leaderboard.js'
import { TARGET_CANONICAL_CSW_ADDRESS } from '../../../src/wallet/canonicalWalletPolicy.js'

export const SCORECARD_SCHEMA = '4626.alfaclub.scorecard.v1' as const

export const SCORECARD_DISCLAIMER =
  '4626 Keepr onchain-derived snapshot. Scores derive from public Base chain data (FriendKey total supply, FriendStake staked supply, Hyperliquid realized 30d PnL) and public Hyperliquid API responses. AlfaClub\'s in-app ranking is a separate proprietary calculation. Not financial advice.' as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScorecardInput = {
  creator: RankedCreator
  snapshotTs: string
  totalCreatorsRanked: number
  sources: {
    friendKeyContract: string
    friendStakeBeacon: string
    friendPool: string
    hyperliquidInfoUrl: string
  }
}

export type Scorecard = {
  schema: typeof SCORECARD_SCHEMA
  generatedAt: string
  snapshotTs: string
  disclaimer: string
  publisher: {
    agentId: number
    agentRegistry: string
    canonicalCsw: string
  }
  creator: {
    address: string
    tokenId: string
  }
  metrics: {
    totalSupply: string
    stakedSupply: string
    hyperliquid: {
      accountValueUsd: number | null
      pnl30dUsd: number | null
    } | null
  }
  scores: {
    popularity: number
    performance: number
    composite: number
    rank: number
    totalRanked: number
  }
  citations: {
    friendKeyContract: string
    friendStakeBeacon: string
    friendPool: string
    hyperliquidInfoUrl: string
  }
}

export type ScorecardWithIntegrity = {
  scorecard: Scorecard
  canonicalJson: string
  hash: `0x${string}`
}

export type PublishScorecardResult = {
  scorecard: Scorecard
  canonicalJson: string
  hash: `0x${string}`
  upload: GroveUploadAttempt
}

// ---------------------------------------------------------------------------
// Configuration (publisher identity is hard-wired to the canonical agent)
// ---------------------------------------------------------------------------

declare const process: { env: Record<string, string | undefined> }

function getAgentId(): number {
  const raw = (process.env.ERC8004_AGENT_ID ?? '').trim()
  if (!/^\d+$/.test(raw)) return 2205
  return Number.parseInt(raw, 10)
}

function getAgentRegistry(): string {
  const registry = (process.env.ERC8004_AGENT_REGISTRY ?? '').trim()
  const chainId = (process.env.ERC8004_AGENT_CHAIN_ID ?? '').trim() || '8453'
  if (registry && /^0x[a-fA-F0-9]{40}$/.test(registry)) {
    return `eip155:${chainId}:${registry.toLowerCase()}`
  }
  // Fallback to the production Base identity registry (advertised in the
  // public agent-registration card).
  return 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
}

function getCanonicalCsw(): string {
  return TARGET_CANONICAL_CSW_ADDRESS
}

// ---------------------------------------------------------------------------
// Build + integrity
// ---------------------------------------------------------------------------

/**
 * Build a canonical scorecard. Pure — no network, no DB, no time lookups
 * beyond the `generatedAt` stamp.
 */
export function buildScorecard(input: ScorecardInput): ScorecardWithIntegrity {
  const { creator } = input
  const scorecard: Scorecard = {
    schema: SCORECARD_SCHEMA,
    generatedAt: new Date().toISOString(),
    snapshotTs: input.snapshotTs,
    disclaimer: SCORECARD_DISCLAIMER,
    publisher: {
      agentId: getAgentId(),
      agentRegistry: getAgentRegistry(),
      canonicalCsw: getCanonicalCsw(),
    },
    creator: {
      address: creator.creatorAddress.toLowerCase(),
      tokenId: creator.tokenId.toString(),
    },
    metrics: {
      totalSupply: creator.totalSupply.toString(),
      stakedSupply: creator.stakedSupply.toString(),
      hyperliquid: creator.hyperliquid
        ? {
            accountValueUsd: creator.hyperliquid.accountValueUsd ?? null,
            pnl30dUsd: creator.hyperliquid.pnl30dUsd ?? null,
          }
        : null,
    },
    scores: {
      popularity: round4(creator.popularityScore),
      performance: round4(creator.performanceScore),
      composite: round4(creator.compositeScore),
      rank: creator.rank,
      totalRanked: input.totalCreatorsRanked,
    },
    citations: {
      friendKeyContract: input.sources.friendKeyContract,
      friendStakeBeacon: input.sources.friendStakeBeacon,
      friendPool: input.sources.friendPool,
      hyperliquidInfoUrl: input.sources.hyperliquidInfoUrl,
    },
  }

  const canonicalJson = JSON.stringify(scorecard)
  const hash = keccak256(toHex(canonicalJson))
  return { scorecard, canonicalJson, hash }
}

/**
 * Derive the exact Lens post body text from a scorecard. Factual only.
 */
export function formatScorecardPostBody(
  scorecard: Scorecard,
  scorecardUri: string,
): string {
  const lines: string[] = [
    `4626 Keepr Integrity Snapshot — ${scorecard.snapshotTs}`,
    `Creator: ${scorecard.creator.address}`,
    `Room (FriendKey tokenId ${scorecard.creator.tokenId}): supply=${scorecard.metrics.totalSupply} · staked=${scorecard.metrics.stakedSupply}`,
  ]
  if (scorecard.metrics.hyperliquid) {
    const accountValue = scorecard.metrics.hyperliquid.accountValueUsd
    const pnl = scorecard.metrics.hyperliquid.pnl30dUsd
    lines.push(
      `Hyperliquid: account=${formatUsd(accountValue)} · pnl30d=${formatUsd(pnl)}`,
    )
  }
  lines.push(
    `Composite score: ${scorecard.scores.composite.toFixed(4)} (rank ${scorecard.scores.rank}/${scorecard.scores.totalRanked})`,
  )
  lines.push(`Full scorecard: ${scorecardUri}`)
  lines.push(scorecard.disclaimer)
  return lines.join('\n')
}

/**
 * Upload a scorecard to Lens Grove. Never throws.
 */
export async function publishScorecard(
  input: ScorecardInput,
): Promise<PublishScorecardResult> {
  const built = buildScorecard(input)
  const upload = await tryUploadImmutableJson(built.scorecard)
  return {
    scorecard: built.scorecard,
    canonicalJson: built.canonicalJson,
    hash: built.hash,
    upload,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round4(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10_000) / 10_000
}

function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`
  return `${sign}$${abs.toFixed(2)}`
}
