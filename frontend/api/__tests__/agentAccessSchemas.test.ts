import { describe, expect, it } from 'vitest'

import {
  agentAccessProofSubmitSchema,
  agentCapabilityResponseSchema,
  agentImageHintSchema,
  agentRoomAccessTokenSchema,
} from '../_handlers/v1/agents/_accessSchemas.ts'

describe('agent access schemas', () => {
  it('accepts canonical capability payloads', () => {
    const parsed = agentCapabilityResponseSchema.parse({
      schema: '4626-agent-capability-response-v1',
      wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      resolverVersion: 1,
      issuedAt: '2026-03-16T18:00:00.000Z',
      memberships: [
        {
          type: 'xmtp',
          shareToken: '0x1111111111111111111111111111111111111111',
          vault: '0x2222222222222222222222222222222222222222',
          roomKey: 'xmtp:group_123',
          qualified: true,
          minBalance: '1',
          actualBalance: '3.5',
          accessTokenRequired: true,
          statusReason: 'qualified',
        },
      ],
    })
    expect(parsed.schema).toBe('4626-agent-capability-response-v1')
    expect(parsed.memberships[0]?.type).toBe('xmtp')
  })

  it('enforces 65-byte hex signatures in proof submit schema', () => {
    const result = agentAccessProofSubmitSchema.safeParse({
      schema: '4626-agent-access-proof-submit-v1',
      proofRequest: {
        schema: '4626-agent-access-proof-request-v1',
        wallet: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
        chainId: 8453,
        shareToken: '0x1111111111111111111111111111111111111111',
        roomKey: 'xmtp:group_123',
        nonce: 'nonce-12345678',
        issuedAt: '2026-03-16T18:00:00.000Z',
        expiresAt: '2026-03-16T18:10:00.000Z',
        message: '4626 Access Proof',
      },
      signature: '0x1234',
      signer: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
    })
    expect(result.success).toBe(false)
  })

  it('applies default tokenType for room tokens', () => {
    const parsed = agentRoomAccessTokenSchema.parse({
      schema: '4626-agent-room-access-token-v1',
      sub: '0x5b674196812451b7cec024fe9d22d2c0b172fa75',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      roomKey: 'telegram:-100123',
      issuedAt: '2026-03-16T18:00:00.000Z',
      expiresAt: '2026-03-16T18:30:00.000Z',
      accessToken: '4626aat.v1.payload.signature',
      capabilities: ['join', 'read'],
      jti: 'nonce-123',
    })
    expect(parsed.tokenType).toBe('bearer')
  })

  it('keeps image hints strict', () => {
    const valid = agentImageHintSchema.safeParse({
      schema: '4626-agent-image-hint-v1',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      resolver: 'https://api.4626.fun/v1/agents/capabilities',
      version: 1,
    })
    expect(valid.success).toBe(true)

    const invalid = agentImageHintSchema.safeParse({
      schema: '4626-agent-image-hint-v1',
      chainId: 8453,
      shareToken: '0x1111111111111111111111111111111111111111',
      resolver: 'https://api.4626.fun/v1/agents/capabilities',
      extra: true,
    })
    expect(invalid.success).toBe(false)
  })
})
