import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/auth/_agent-verify.ts'
import { createMockReq, createMockRes } from './helpers'

const AGENT_REGISTRY = 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
const REGISTRY_ADDRESS = '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
const CANONICAL_CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
const OTHER_CSW = '0x3333333333333333333333333333333333333333'

const {
  verifySIWAMock,
  readJsonBodyMock,
  parseSiwaMessageSafeMock,
  parseAgentRegistryRefMock,
  ensureSiwaNonceSchemaMock,
  consumeSiwaNonceMock,
  createSiwaReceiptTokenMock,
  getSiwaReceiptSecretMock,
  createPublicClientMock,
  resolveCanonicalSmartWalletAddressMock,
  getIdentityRegistryAddressMock,
  getDbMock,
  clientReadContractMock,
  getTrustedRequestOriginsMock,
  normalizeOriginMock,
} = vi.hoisted(() => ({
  verifySIWAMock: vi.fn(),
  readJsonBodyMock: vi.fn(async (req: any) => req.body ?? {}),
  parseSiwaMessageSafeMock: vi.fn(),
  parseAgentRegistryRefMock: vi.fn(),
  ensureSiwaNonceSchemaMock: vi.fn(async () => {}),
  consumeSiwaNonceMock: vi.fn(),
  createSiwaReceiptTokenMock: vi.fn(),
  getSiwaReceiptSecretMock: vi.fn(() => 'siwa-secret'),
  createPublicClientMock: vi.fn(),
  resolveCanonicalSmartWalletAddressMock: vi.fn(async () => CANONICAL_CSW),
  getIdentityRegistryAddressMock: vi.fn(() => REGISTRY_ADDRESS),
  getDbMock: vi.fn(async () => ({ sql: vi.fn() })),
  clientReadContractMock: vi.fn(),
  getTrustedRequestOriginsMock: vi.fn(),
  normalizeOriginMock: vi.fn(),
}))

vi.mock('@buildersgarden/siwa', () => ({
  SIWAErrorCode: {
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',
    INVALID_NONCE: 'INVALID_NONCE',
    INVALID_REGISTRY_FORMAT: 'INVALID_REGISTRY_FORMAT',
    DOMAIN_MISMATCH: 'DOMAIN_MISMATCH',
    MESSAGE_EXPIRED: 'MESSAGE_EXPIRED',
    MESSAGE_NOT_YET_VALID: 'MESSAGE_NOT_YET_VALID',
    NOT_OWNER: 'NOT_OWNER',
    NOT_REGISTERED: 'NOT_REGISTERED',
  },
  verifySIWA: verifySIWAMock,
}))

vi.mock('../../packages/server-core/src/index.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  getDb: getDbMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  consumeSiwaNonce: consumeSiwaNonceMock,
  createSiwaReceiptToken: createSiwaReceiptTokenMock,
  ensureSiwaNonceSchema: ensureSiwaNonceSchemaMock,
  getSiwaReceiptSecret: getSiwaReceiptSecretMock,
  parseAgentRegistryRef: parseAgentRegistryRefMock,
  parseSiwaMessageSafe: parseSiwaMessageSafeMock,
}))

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolveCanonicalSmartWalletAddress: resolveCanonicalSmartWalletAddressMock,
}))

vi.mock('../../server/_lib/erc8004.js', () => ({
  getIdentityRegistryAddress: getIdentityRegistryAddressMock,
}))

vi.mock('../../server/_lib/trust.js', () => ({
  getTrustedRequestOrigins: getTrustedRequestOriginsMock,
  normalizeOrigin: normalizeOriginMock,
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({ transport: 'http' })),
  }
})

vi.mock('viem/chains', () => ({
  base: {},
}))

describe('agent SIWA verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    parseSiwaMessageSafeMock.mockReturnValue({
      domain: 'v1.4626.fun',
      uri: 'https://v1.4626.fun',
      address: CANONICAL_CSW,
      agentId: 2205,
      agentRegistry: AGENT_REGISTRY,
      chainId: 8453,
      nonce: 'nonce-123',
      expirationTime: '2099-01-01T00:00:00.000Z',
    })
    parseAgentRegistryRefMock.mockReturnValue({
      chainId: 8453,
      registryAddress: REGISTRY_ADDRESS,
    })
    verifySIWAMock.mockImplementation(async (_message: string, _signature: string, _domain: string, consumeNonce: (nonce: string) => Promise<boolean>) => {
      await consumeNonce('nonce-123')
      return {
        valid: true,
        address: CANONICAL_CSW,
        agentId: 2205,
        agentRegistry: AGENT_REGISTRY,
        chainId: 8453,
        verified: 'onchain',
      }
    })
    consumeSiwaNonceMock.mockResolvedValue({ ownerAddress: CANONICAL_CSW })
    createSiwaReceiptTokenMock.mockReturnValue({
      receipt: 'siwa-receipt-token',
      expiresAt: '2099-01-01T01:00:00.000Z',
    })
    clientReadContractMock.mockResolvedValue(CANONICAL_CSW)
    createPublicClientMock.mockReturnValue({
      readContract: clientReadContractMock,
    })
    getTrustedRequestOriginsMock.mockReturnValue(new Set(['https://v1.4626.fun']))
    normalizeOriginMock.mockImplementation((value: string) => String(value || '').trim().toLowerCase())
    resolveCanonicalSmartWalletAddressMock.mockResolvedValue(CANONICAL_CSW)
  })

  it('returns a receipt for a valid SIWA payload', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data).toMatchObject({
      address: CANONICAL_CSW,
      ownerAddress: CANONICAL_CSW,
      agentId: 2205,
      agentRegistry: AGENT_REGISTRY,
      chainId: 8453,
      verified: 'onchain',
      receipt: 'siwa-receipt-token',
    })
  })

  it('rejects invalid SIWA signatures from verifySIWA', async () => {
    verifySIWAMock.mockResolvedValueOnce({
      valid: false,
      code: 'INVALID_SIGNATURE',
      error: 'Invalid signature',
    })
    const req = createMockReq({
      method: 'POST',
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('INVALID_SIGNATURE')
  })

  it('rejects SIWA payloads when URI origin is not trusted', async () => {
    normalizeOriginMock.mockReturnValueOnce('https://evil.example')
    const req = createMockReq({
      method: 'POST',
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('URI mismatch')
  })

  it('rejects SIWA payloads whose nonce owner differs from message address', async () => {
    consumeSiwaNonceMock.mockResolvedValueOnce({ ownerAddress: OTHER_CSW })
    const req = createMockReq({
      method: 'POST',
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toBe('SIWA message address does not match nonce owner')
  })
})
