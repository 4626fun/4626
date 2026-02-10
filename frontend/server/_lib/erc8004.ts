/**
 * ERC-8004 registry types, ABIs, and helpers.
 *
 * Covers all three ERC-8004 registries:
 *   - Identity Registry  (ERC-721 agent NFTs + agentWallet + metadata)
 *   - Reputation Registry (feedback signals)
 *   - Validation Registry (validator request/response — spec still evolving)
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

/**
 * ERC-8004 Validation Registry.
 * NOTE: No deterministic mainnet address published yet — the spec is still
 * under active discussion with the TEE community. Set via env override when
 * available.
 */
export const ERC8004_VALIDATION_REGISTRY = '' as const

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

export function getValidationRegistryAddress(): `0x${string}` | null {
  const override = (process.env.ERC8004_VALIDATION_REGISTRY ?? '').trim()
  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) return override as `0x${string}`
  if (ERC8004_VALIDATION_REGISTRY && /^0x[a-fA-F0-9]{40}$/.test(ERC8004_VALIDATION_REGISTRY)) {
    return ERC8004_VALIDATION_REGISTRY as `0x${string}`
  }
  return null
}

// ---------------------------------------------------------------------------
// Identity Registry ABI (agent NFTs, agentWallet, metadata)
// ---------------------------------------------------------------------------

export const IDENTITY_REGISTRY_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setAgentWallet',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newWallet', type: 'address' },
      { name: 'deadline', type: 'uint256' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unsetAgentWallet',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMetadata',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
      { name: 'metadataValue', type: 'bytes' },
    ],
    outputs: [],
  },

  // ── Read ───────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getMetadata',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'metadataKey', type: 'string' },
    ],
    outputs: [{ type: 'bytes' }],
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
    name: 'Registered',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'agentURI', type: 'string' },
      { indexed: true, name: 'owner', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'URIUpdated',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'newURI', type: 'string' },
      { indexed: true, name: 'updatedBy', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'MetadataSet',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'indexedMetadataKey', type: 'string' },
      { indexed: false, name: 'metadataKey', type: 'string' },
      { indexed: false, name: 'metadataValue', type: 'bytes' },
    ],
  },
] as const

// ---------------------------------------------------------------------------
// Validation Registry ABI (validator request/response — spec evolving)
// ---------------------------------------------------------------------------

export const VALIDATION_REGISTRY_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'validationRequest',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'validatorAddress', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'requestURI', type: 'string' },
      { name: 'requestHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'validationResponse',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'requestHash', type: 'bytes32' },
      { name: 'response', type: 'uint8' },
      { name: 'responseURI', type: 'string' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'tag', type: 'string' },
    ],
    outputs: [],
  },

  // ── Read ───────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getValidationStatus',
    stateMutability: 'view',
    inputs: [{ name: 'requestHash', type: 'bytes32' }],
    outputs: [
      { name: 'validatorAddress', type: 'address' },
      { name: 'agentId', type: 'uint256' },
      { name: 'response', type: 'uint8' },
      { name: 'responseHash', type: 'bytes32' },
      { name: 'tag', type: 'string' },
      { name: 'lastUpdate', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'validatorAddresses', type: 'address[]' },
      { name: 'tag', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'avgResponse', type: 'uint8' },
    ],
  },
  {
    type: 'function',
    name: 'getAgentValidations',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'getValidatorRequests',
    stateMutability: 'view',
    inputs: [{ name: 'validatorAddress', type: 'address' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'getIdentityRegistry',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
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
    name: 'ValidationRequest',
    inputs: [
      { indexed: true, name: 'validatorAddress', type: 'address' },
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: false, name: 'requestURI', type: 'string' },
      { indexed: true, name: 'requestHash', type: 'bytes32' },
    ],
  },
  {
    type: 'event',
    name: 'ValidationResponse',
    inputs: [
      { indexed: true, name: 'validatorAddress', type: 'address' },
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'requestHash', type: 'bytes32' },
      { indexed: false, name: 'response', type: 'uint8' },
      { indexed: false, name: 'responseURI', type: 'string' },
      { indexed: false, name: 'responseHash', type: 'bytes32' },
      { indexed: false, name: 'tag', type: 'string' },
    ],
  },
] as const

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

/** Identity Registry function selectors for paymaster allowlisting. */
export const IDENTITY_REGISTRY_SELECTORS = {
  register: '0xf2c298be',         // register(string)
  setAgentURI: '0x0af28bd3',      // setAgentURI(uint256,string)
  setAgentWallet: '0x2d1ef5ae',   // setAgentWallet(uint256,address,uint256,bytes)
  unsetAgentWallet: '0x3fddcf19', // unsetAgentWallet(uint256)
  setMetadata: '0x466648da',      // setMetadata(uint256,string,bytes)
} as const

/** Validation Registry function selectors for paymaster allowlisting. */
export const VALIDATION_REGISTRY_SELECTORS = {
  validationRequest: '0xaaf400c4',  // validationRequest(address,uint256,string,bytes32)
  validationResponse: '0x3d659a96', // validationResponse(bytes32,uint8,string,bytes32,string)
} as const
