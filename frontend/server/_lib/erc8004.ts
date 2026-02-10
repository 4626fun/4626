/**
 * ERC-8004 Reputation Registry types, ABI, and helpers.
 *
 * Deployed on Base (and many other chains) at the same deterministic address.
 * See: https://github.com/erc-8004/erc-8004-contracts
 */

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Contract addresses (deterministic across chains)
// ---------------------------------------------------------------------------

/** ERC-8004 Identity Registry (ERC-721 agent NFTs). */
export const ERC8004_IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const

/** ERC-8004 Reputation Registry (feedback signals). */
export const ERC8004_REPUTATION_REGISTRY = '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as const

export function getReputationRegistryAddress(): `0x${string}` {
  const override = (process.env.ERC8004_REPUTATION_REGISTRY ?? '').trim()
  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) return override as `0x${string}`
  return ERC8004_REPUTATION_REGISTRY
}

export function getIdentityRegistryAddress(): `0x${string}` {
  const override = (process.env.ERC8004_AGENT_REGISTRY ?? '').trim()
  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) return override as `0x${string}`
  return ERC8004_IDENTITY_REGISTRY
}

// ---------------------------------------------------------------------------
// Reputation Registry ABI (minimal – write + read functions we use)
// ---------------------------------------------------------------------------

export const REPUTATION_REGISTRY_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'giveFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'endpoint', type: 'string' },
      { name: 'feedbackURI', type: 'string' },
      { name: 'feedbackHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'revokeFeedback',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'feedbackIndex', type: 'uint64' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'appendResponse',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
    ],
    outputs: [],
  },

  // ── Read ───────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'readFeedback',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
    ],
    outputs: [
      { name: 'value', type: 'int128' },
      { name: 'valueDecimals', type: 'uint8' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'isRevoked', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'readAllFeedback',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
      { name: 'includeRevoked', type: 'bool' },
    ],
    outputs: [
      { name: 'clients', type: 'address[]' },
      { name: 'feedbackIndexes', type: 'uint64[]' },
      { name: 'values', type: 'int128[]' },
      { name: 'valueDecimals', type: 'uint8[]' },
      { name: 'tag1s', type: 'string[]' },
      { name: 'tag2s', type: 'string[]' },
      { name: 'revokedStatuses', type: 'bool[]' },
    ],
  },
  {
    type: 'function',
    name: 'getLastIndex',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
    ],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getResponseCount',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddress', type: 'address' },
      { name: 'feedbackIndex', type: 'uint64' },
      { name: 'responders', type: 'address[]' },
    ],
    outputs: [{ name: 'count', type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'getVersion',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },

  // ── Events ─────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'NewFeedback',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'clientAddress', type: 'address' },
      { indexed: false, name: 'feedbackIndex', type: 'uint64' },
      { indexed: false, name: 'value', type: 'int128' },
      { indexed: false, name: 'valueDecimals', type: 'uint8' },
      { indexed: true, name: 'indexedTag1', type: 'string' },
      { indexed: false, name: 'tag1', type: 'string' },
      { indexed: false, name: 'tag2', type: 'string' },
      { indexed: false, name: 'endpoint', type: 'string' },
      { indexed: false, name: 'feedbackURI', type: 'string' },
      { indexed: false, name: 'feedbackHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'FeedbackRevoked',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'clientAddress', type: 'address' },
      { indexed: true, name: 'feedbackIndex', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'ResponseAppended',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'clientAddress', type: 'address' },
      { indexed: false, name: 'feedbackIndex', type: 'uint64' },
      { indexed: true, name: 'responder', type: 'address' },
      { indexed: false, name: 'responseURI', type: 'string' },
      { indexed: false, name: 'responseHash', type: 'bytes32' },
    ],
  },
] as const

// ---------------------------------------------------------------------------
// TypeScript types for feedback payloads (v2.0 spec)
// ---------------------------------------------------------------------------

/** Attachment in an off-chain feedback payload. */
export type FeedbackAttachment = {
  name: string
  uri: string
  mimeType?: string
  size?: number
  description?: string
  uploadedAt?: string
}

/** x402 proof-of-payment metadata. */
export type ProofOfPayment = {
  protocol: string
  amount: string
  currency: string
  txHash?: string
  chainId?: number
  timestamp?: string
}

/**
 * Off-chain feedback payload (stored at feedbackURI).
 * Follows the ERC-8004 v2.0 feedback best-practices guide.
 */
export type FeedbackPayload = {
  /** CAIP-10 agent registry reference. */
  agentRegistry: string
  /** On-chain agent ID (ERC-721 tokenId). */
  agentId: number
  /** CAIP-10 client address. */
  clientAddress: string
  /** ISO-8601 timestamp. */
  createdAt: string

  /** Signed fixed-point value (string to avoid JS precision issues). */
  value: string
  /** Number of decimals (0 = integer stars, 1 = half-stars, etc.). */
  valueDecimals: number

  /** Human-readable reasoning. */
  reasoning?: string
  /** Whether the issue is reproducible. */
  reproducible?: boolean

  /** Primary tag (metric type / category). */
  tag1?: string
  /** Secondary tag. */
  tag2?: string

  /** Attachments (evidence). */
  attachments?: FeedbackAttachment[]

  /** x402 payment proof. */
  proofOfPayment?: ProofOfPayment

  // Protocol-specific optional fields
  /** A2A skill path. */
  skill?: string
  /** A2A domain. */
  domain?: string
  /** A2A context. */
  context?: string
  /** MCP capability. */
  capability?: string
  /** MCP tool/prompt name. */
  name?: string

  /** Endpoint tested. */
  endpoint?: string
}

/**
 * On-chain feedback entry (decoded from readFeedback / readAllFeedback).
 */
export type OnChainFeedback = {
  agentId: number
  clientAddress: string
  feedbackIndex: number
  value: number
  valueDecimals: number
  tag1: string
  tag2: string
  isRevoked: boolean
}

/**
 * Aggregated summary (decoded from getSummary).
 */
export type FeedbackSummary = {
  agentId: number
  count: number
  summaryValue: number
  summaryValueDecimals: number
  /** Human-readable average (e.g. "4.2"). */
  displayValue: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert signed value + decimals to a human-readable string. */
export function formatFeedbackValue(value: number | bigint, valueDecimals: number): string {
  const v = Number(value)
  if (valueDecimals === 0) return String(v)
  const divisor = 10 ** valueDecimals
  return (v / divisor).toFixed(valueDecimals)
}

/** Standard 5-star rating labels. */
export function ratingLabel(value: number): string {
  if (value >= 5) return 'Outstanding'
  if (value >= 4) return 'Good'
  if (value >= 3) return 'Acceptable'
  if (value >= 2) return 'Below Average'
  if (value >= 1) return 'Poor'
  if (value >= 0) return 'Very Poor'
  return 'Dispute / Scam'
}

/** Function selectors for paymaster allowlisting. */
export const REPUTATION_REGISTRY_SELECTORS = {
  giveFeedback: '0x3c036a7e',
  revokeFeedback: '0x4ab3ca99',
  appendResponse: '0xc2349ab2',
} as const
