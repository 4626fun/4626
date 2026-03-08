import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/auth/_agent-verify.ts'
import { createMockReq, createMockRes } from './helpers'

const AGENT_REGISTRY = 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
const REGISTRY_ADDRESS = '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432'
const CANONICAL_CSW = '0xab6d5c10b03300326cd7fab7267ae192842967b5'
const OTHER_CSW = '0x3333333333333333333333333333333333333333'
const DELEGATED_OWNER = '0x1111111111111111111111111111111111111111'
const OUTSIDER = '0x2222222222222222222222222222222222222222'

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
  recoverMessageAddressMock,
  clientVerifyMessageMock,
  clientReadContractMock,
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
  recoverMessageAddressMock: vi.fn(),
  clientVerifyMessageMock: vi.fn(),
  clientReadContractMock: vi.fn(),
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

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  hostMatchesDomain: vi.fn((host: string, domain: string) => host === domain),
  readJsonBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
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

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({ transport: 'http' })),
    recoverMessageAddress: recoverMessageAddressMock,
  }
})

vi.mock('viem/chains', () => ({
  base: {},
}))

describe('agent SIWA verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    parseSiwaMessageSafeMock.mockReturnValue({
      domain: 'app.4626.fun',
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
    verifySIWAMock.mockResolvedValue({
      valid: false,
      code: 'INVALID_SIGNATURE',
      error: 'Invalid signature',
      address: CANONICAL_CSW,
      agentId: 2205,
      agentRegistry: AGENT_REGISTRY,
      chainId: 8453,
      verified: 'onchain',
    })
    consumeSiwaNonceMock.mockResolvedValue({ ownerAddress: CANONICAL_CSW })
    createSiwaReceiptTokenMock.mockReturnValue({
      receipt: 'siwa-receipt-token',
      expiresAt: '2099-01-01T01:00:00.000Z',
    })
    clientVerifyMessageMock.mockResolvedValue(false)
    clientReadContractMock.mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'ownerOf') return CANONICAL_CSW
      if (functionName === 'isOwnerAddress') return String(args?.[0] ?? '').toLowerCase() === DELEGATED_OWNER
      throw new Error(`Unexpected function ${functionName}`)
    })
    createPublicClientMock.mockReturnValue({
      verifyMessage: clientVerifyMessageMock,
      readContract: clientReadContractMock,
    })
    resolveCanonicalSmartWalletAddressMock.mockResolvedValue(CANONICAL_CSW)
  })

  it('accepts a delegated CSW owner when the SIWA library rejects the raw signature', async () => {
    recoverMessageAddressMock.mockResolvedValue(DELEGATED_OWNER)

    const req = createMockReq({
      method: 'POST',
      headers: { host: 'app.4626.fun' },
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
    expect(consumeSiwaNonceMock).toHaveBeenCalledTimes(1)
    expect(clientReadContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CANONICAL_CSW,
        functionName: 'isOwnerAddress',
        args: [DELEGATED_OWNER],
      }),
    )
  })

  it('still rejects signatures from wallets that do not own the canonical CSW', async () => {
    recoverMessageAddressMock.mockResolvedValue(OUTSIDER)

    const req = createMockReq({
      method: 'POST',
      headers: { host: 'app.4626.fun' },
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'INVALID_SIGNATURE: Invalid signature',
    })
    expect(consumeSiwaNonceMock).not.toHaveBeenCalled()
  })

  it('rejects SIWA messages whose address no longer matches the nonce-bound canonical owner', async () => {
    parseSiwaMessageSafeMock.mockReturnValue({
      domain: 'app.4626.fun',
      address: OTHER_CSW,
      agentId: 2205,
      agentRegistry: AGENT_REGISTRY,
      chainId: 8453,
      nonce: 'nonce-123',
      expirationTime: '2099-01-01T00:00:00.000Z',
    })
    recoverMessageAddressMock.mockResolvedValue(DELEGATED_OWNER)
    clientReadContractMock.mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'ownerOf') return CANONICAL_CSW
      if (functionName === 'isOwnerAddress') return String(args?.[0] ?? '').toLowerCase() === DELEGATED_OWNER
      throw new Error(`Unexpected function ${functionName}`)
    })

    const req = createMockReq({
      method: 'POST',
      headers: { host: 'app.4626.fun' },
      body: {
        message: 'siwa-message',
        signature: '0xsig',
      },
    })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({
      success: false,
      error: 'SIWA message address does not match nonce owner',
    })
  })
})
