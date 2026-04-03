import { describe, expect, it } from 'vitest'

import { redactForRemoteAi, redactTextForRemoteAi, redactToJsonForRemoteAi } from '../redaction.js'

describe('agent control redaction middleware', () => {
  it('strips denied secret fields and pseudonymizes actor identifiers', () => {
    const payload = redactForRemoteAi({
      userId: 'user-123',
      telegramUserId: '1234567',
      privateKey: 'fixture',
      signedPayload: '0xdeadbeef',
      details: {
        authorization: 'Bearer abcdefghijklmnop',
        message: 'hello',
      },
    })

    expect(payload).toMatchObject({
      userId: expect.stringMatching(/^anon_/),
      telegramUserId: expect.stringMatching(/^anon_/),
      privateKey: '[redacted]',
      signedPayload: '[redacted]',
      details: {
        authorization: '[redacted]',
        message: 'hello',
      },
    })
  })

  it('masks addresses and clips long strings for remote-ai payloads', () => {
    const payload = redactForRemoteAi(
      {
        walletAddress: '0x00000000000000000000000000000000000000aa',
        note:
          'Bearer verylongtoken_abcdefghijklmnopqrstuvwxyz0123456789 and key sk-abcdefghijklmnopqrstuvwxyz123456',
      },
      {
        maxStringLength: 80,
        maskAddresses: true,
      },
    ) as Record<string, unknown>

    expect(String(payload.walletAddress)).toBe('0x0000…00aa')
    expect(String(payload.note)).toContain('Bearer [redacted]')
    expect(String(payload.note)).toContain('[redacted-api-key]')
    expect(String(payload.note).length).toBeLessThanOrEqual(80)
  })

  it('supports top-level allowlists and JSON conversion', () => {
    const json = redactToJsonForRemoteAi(
      {
        vaultAddress: '0x00000000000000000000000000000000000000aa',
        alerts: [{ alertType: 'x', message: 'ok', privateKey: 'nope' }],
        internalBlob: { any: 'value' },
      },
      {
        allowFields: ['vaultAddress', 'alerts'],
      },
    )
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect(parsed.vaultAddress).toBe('0x0000…00aa')
    expect(parsed.internalBlob).toBeUndefined()
    expect(parsed.alerts).toBeDefined()
  })

  it('redacts inline secrets in text payloads', () => {
    const output = redactTextForRemoteAi(
      'Use 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa and sk-secretkey123456',
      { maxStringLength: 200 },
    )
    expect(output).toContain('[redacted-hex-secret]')
    expect(output).toContain('[redacted-api-key]')
  })
})
