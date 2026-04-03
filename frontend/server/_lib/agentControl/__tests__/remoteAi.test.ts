import { describe, expect, it } from 'vitest'

import {
  assertRemoteAiEndpoint,
  prepareRemoteAiJsonPayload,
  prepareRemoteAiText,
} from '../remoteAi.js'

describe('agent control remote ai helpers', () => {
  it('redacts text payloads before they leave the process', () => {
    const output = prepareRemoteAiText(
      'Use wallet 0x00000000000000000000000000000000000000aa with Bearer secret-token and sk-secretkey123456',
      { maxStringLength: 200 },
    )

    expect(output).toContain('0x0000…00aa')
    expect(output).toContain('Bearer [redacted]')
    expect(output).toContain('[redacted-api-key]')
  })

  it('allowlists top-level fields for structured payloads', () => {
    const payload = prepareRemoteAiJsonPayload(
      {
        vaultAddress: '0x00000000000000000000000000000000000000aa',
        alerts: [{ message: 'ok', privateKey: 'fixture' }],
        internalBlob: { debug: 'should-not-leak' },
      },
      {
        allowFields: ['vaultAddress', 'alerts'],
        maxDepth: 4,
      },
    ) as Record<string, unknown>

    expect(payload.vaultAddress).toBe('0x0000…00aa')
    expect(payload.internalBlob).toBeUndefined()
    expect(payload.alerts).toEqual([
      {
        message: 'ok',
        privateKey: '[redacted]',
      },
    ])
  })

  it('allows only known remote ai providers', () => {
    expect(assertRemoteAiEndpoint('https://api.openai.com/v1/responses')).toBe(
      'https://api.openai.com/v1/responses',
    )
    expect(assertRemoteAiEndpoint('https://api.groq.com/openai/v1/chat/completions')).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    )
    expect(() => assertRemoteAiEndpoint('http://api.openai.com/v1/responses')).toThrow(
      /https/i,
    )
    expect(() => assertRemoteAiEndpoint('https://example.com/llm')).toThrow(
      /allowlist/i,
    )
  })
})
