import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../wallet/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: vi.fn(async () => null),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: vi.fn(async () => ({ sql: vi.fn(async () => ({ rows: [] })) })),
  isDbConfigured: vi.fn(() => true),
}))

vi.mock('../db/schemaBootstrap.js', () => ({
  ensureTelemetryCreativeLogsSchema: vi.fn(async () => {}),
}))

import { decryptPrivateKey, enableCswAgent } from './creatorXmtpAgents.js'
import { resolveCanonicalSmartWalletAddress } from '../wallet/canonicalWalletResolver.js'

describe('creatorXmtpAgents hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decryptPrivateKey rejects csw-managed sentinel values', () => {
    expect(() =>
      decryptPrivateKey({
        ciphertextB64: 'csw-managed',
        ivB64: 'csw-managed',
        tagB64: 'csw-managed',
        aad: 'creator:0x1234567890123456789012345678901234567890',
      }),
    ).toThrow(/legacy_eoa_xmtp_retired/)
  })

  it('enableCswAgent rejects empty privyWalletId', async () => {
    await expect(
      enableCswAgent({
        creatorAddress: '0x1234567890123456789012345678901234567890',
        cswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        privyWalletId: '   ',
      }),
    ).rejects.toThrow(/privyWalletId required/)
  })

  it('enableCswAgent rejects cswAddress that drifts from profile canonical CSW', async () => {
    vi.mocked(resolveCanonicalSmartWalletAddress).mockResolvedValue(
      '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    )

    await expect(
      enableCswAgent({
        creatorAddress: '0x1234567890123456789012345678901234567890',
        cswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
        privyWalletId: 'privy-wallet-id',
      }),
    ).rejects.toThrow(/canonical smart wallet/)
  })
})
