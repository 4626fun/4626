import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keeper/_solanaActivateB2Relay.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  getDbForCronMock,
  isDbConfiguredMock,
  readBoundedJsonObjectBodyMock,
  requireKeeprApiKeyMock,
  markRelayEnabledMock,
} = vi.hoisted(() => ({
  getDbForCronMock: vi.fn(),
  isDbConfiguredMock: vi.fn(),
  readBoundedJsonObjectBodyMock: vi.fn(async (req: any) => req.body),
  requireKeeprApiKeyMock: vi.fn(() => true),
  markRelayEnabledMock: vi.fn(),
}))

vi.mock('@4626/server-core', () => ({
  getDbForCron: getDbForCronMock,
  handleOptions: vi.fn(() => false),
  isDbConfigured: isDbConfiguredMock,
  readBoundedJsonObjectBody: readBoundedJsonObjectBodyMock,
  requireKeeprApiKey: requireKeeprApiKeyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/onchain/solanaCreatorRelayConfig.js', () => ({
  markSolanaCreatorRelayEnabled: markRelayEnabledMock,
}))

describe('keeper Solana B2 activation endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED
    isDbConfiguredMock.mockReturnValue(true)
    getDbForCronMock.mockResolvedValue({ sql: vi.fn() })
  })

  it('is unavailable by default before reading activation evidence', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { shareMeshMint: 'mint', evidence: { explicitProductionApproval: true } },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(res.body?.error).toBe('b2_production_activation_disabled')
    expect(readBoundedJsonObjectBodyMock).not.toHaveBeenCalled()
    expect(markRelayEnabledMock).not.toHaveBeenCalled()
  })

  it('requires machine authentication even during an activation window', async () => {
    process.env.SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED = '1'
    requireKeeprApiKeyMock.mockReturnValueOnce(false)
    const req = createMockReq({ method: 'POST', body: {} })
    const res = createMockRes()
    await handler(req, res)

    expect(markRelayEnabledMock).not.toHaveBeenCalled()
    expect(getDbForCronMock).not.toHaveBeenCalled()
  })

  it('enables only when the durable activation function returns a verified row', async () => {
    process.env.SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED = '1'
    const evidence = {
      explicitProductionApproval: true,
      approvalRef: 'production-approval-1',
      sourceEventId: 'source-event-1',
    }
    markRelayEnabledMock.mockResolvedValueOnce({
      shareMeshMint: 'So11111111111111111111111111111111111111112',
      relayEnabled: true,
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        shareMeshMint: 'So11111111111111111111111111111111111111112',
        evidence,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(markRelayEnabledMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shareMeshMint: 'So11111111111111111111111111111111111111112',
        evidence,
      }),
    )
    expect(res.body?.data?.relayEnabled).toBe(true)
  })

  it('returns a conflict when durable canary or readiness evidence is absent', async () => {
    process.env.SOLANA_B2_PRODUCTION_ACTIVATION_ENABLED = '1'
    markRelayEnabledMock.mockResolvedValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: { shareMeshMint: 'So11111111111111111111111111111111111111112', evidence: {} },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.error).toBe('b2_readiness_not_verified')
  })
})
