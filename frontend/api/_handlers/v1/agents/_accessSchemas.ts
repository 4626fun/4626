import { z } from 'zod'

export const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
export const SIGNATURE_REGEX = /^0x[a-fA-F0-9]{130}$/
export const DECIMAL_STRING_REGEX = /^[0-9]+(\.[0-9]+)?$/

const isoDateTimeString = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), 'Must be an ISO date-time string')

const nonEmptyString = z.string().min(1)

export const membershipTypeSchema = z.enum(['xmtp', 'telegram', 'vault-ui', 'governance'])
export type MembershipType = z.infer<typeof membershipTypeSchema>

export const membershipStatusReasonSchema = z.enum([
  'qualified',
  'insufficient_balance',
  'insufficient_hold_time',
  'revoked',
  'unsupported_chain',
  'not_found',
])
export type MembershipStatusReason = z.infer<typeof membershipStatusReasonSchema>

export const agentMembershipSchema = z
  .object({
    type: membershipTypeSchema,
    shareToken: z.string().regex(ADDRESS_REGEX),
    vault: z
      .string()
      .regex(ADDRESS_REGEX)
      .optional()
      .describe('Vault contract address (present for most types)'),
    roomKey: z.string().min(1).max(128),
    qualified: z.boolean(),
    minBalance: z.string().regex(DECIMAL_STRING_REGEX),
    actualBalance: z.string().regex(DECIMAL_STRING_REGEX),
    minHoldSeconds: z.number().int().min(0).optional(),
    qualifiedSince: z.number().int().min(0).optional(),
    gracePeriodSeconds: z.number().int().min(0).optional(),
    accessTokenRequired: z.boolean().optional(),
    statusReason: membershipStatusReasonSchema.optional(),
  })
  .strict()
export type AgentMembership = z.infer<typeof agentMembershipSchema>

export const agentCapabilityResponseSchema = z
  .object({
    schema: z.literal('4626-agent-capability-response-v1'),
    wallet: z
      .string()
      .regex(ADDRESS_REGEX)
      .describe('Wallet address (EOA or smart-contract)'),
    chainId: z.number().int().min(1),
    resolverVersion: z.number().int().min(1),
    issuedAt: isoDateTimeString,
    memberships: z.array(agentMembershipSchema),
  })
  .strict()
export type AgentCapabilityResponse = z.infer<typeof agentCapabilityResponseSchema>

export const agentAccessProofRequestSchema = z
  .object({
    schema: z.literal('4626-agent-access-proof-request-v1'),
    wallet: z.string().regex(ADDRESS_REGEX),
    chainId: z.number().int().min(1),
    shareToken: z.string().regex(ADDRESS_REGEX),
    roomKey: z.string().min(1).max(128),
    nonce: z
      .string()
      .min(8)
      .max(128)
      .describe('Unique nonce (UUID recommended)'),
    issuedAt: isoDateTimeString,
    expiresAt: isoDateTimeString,
    message: nonEmptyString.describe('Human-readable string for signing'),
  })
  .strict()
export type AgentAccessProofRequest = z.infer<typeof agentAccessProofRequestSchema>

export const agentAccessProofSubmitSchema = z
  .object({
    schema: z.literal('4626-agent-access-proof-submit-v1'),
    proofRequest: agentAccessProofRequestSchema,
    signature: z
      .string()
      .regex(SIGNATURE_REGEX)
      .describe('0x-prefixed ECDSA signature (65 bytes)'),
    signer: z
      .string()
      .regex(ADDRESS_REGEX)
      .describe('Wallet that performed the signature'),
  })
  .strict()
export type AgentAccessProofSubmit = z.infer<typeof agentAccessProofSubmitSchema>

export const roomCapabilitySchema = z.enum(['join', 'read', 'write', 'react', 'view-members'])
export type RoomCapability = z.infer<typeof roomCapabilitySchema>

export const agentRoomAccessTokenSchema = z
  .object({
    schema: z.literal('4626-agent-room-access-token-v1'),
    sub: z.string().regex(ADDRESS_REGEX),
    chainId: z.number().int().min(1),
    shareToken: z.string().regex(ADDRESS_REGEX),
    roomKey: z.string().min(1).max(128),
    issuedAt: isoDateTimeString,
    expiresAt: isoDateTimeString,
    accessToken: z.string().min(16),
    tokenType: z.literal('bearer').optional().default('bearer'),
    capabilities: z.array(roomCapabilitySchema).optional(),
    jti: z
      .string()
      .min(1)
      .optional()
      .describe('JWT ID for revocation tracking (optional but recommended)'),
  })
  .strict()
export type AgentRoomAccessToken = z.infer<typeof agentRoomAccessTokenSchema>

export const agentImageHintSchema = z
  .object({
    schema: z.literal('4626-agent-image-hint-v1'),
    chainId: z.number().int().min(1),
    shareToken: z.string().regex(ADDRESS_REGEX),
    vault: z.string().regex(ADDRESS_REGEX).optional(),
    resolver: z.string().url(),
    version: z.number().int().min(1).optional(),
    checksum: z.string().min(4).max(64).optional(),
  })
  .strict()
export type AgentImageHint = z.infer<typeof agentImageHintSchema>
