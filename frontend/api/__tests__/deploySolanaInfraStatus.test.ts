import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_solanaInfraStatus.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  getSessionAddressMock,
  isAdminAddressMock,
  getApiContractsMock,
  createPublicClientMock,
} = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(),
  isAdminAddressMock: vi.fn(),
  getApiContractsMock: vi.fn(),
  createPublicClientMock: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: getApiContractsMock,
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({})),
  }
})

describe('deploy solana infra status handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue('0x1111111111111111111111111111111111111111')
    isAdminAddressMock.mockReturnValue(true)
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753',
    })
  })

  it('returns 401 when session is missing', async () => {
    getSessionAddressMock.mockReturnValueOnce(null)
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(String(res.body?.error ?? '')).toContain('Sign in required')
  })

  it('reports dynamic runner misconfiguration and invalid signer key', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_BRIDGE_CLI_DIR: '/definitely/missing/path',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: undefined,
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY: 'not-a-hex-private-key',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      KEEPR_PRIVATE_KEY: undefined,
      PRIVATE_KEY: undefined,
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
      }
      createPublicClientMock.mockReturnValue(mockPublicClient as any)

      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.dynamicProvisioningMode).toBe('misconfigured')
      expect(res.body?.data?.signerConfigured).toBe(false)
      expect(res.body?.data?.readyForAutoRegistration).toBe(false)
      expect(res.body?.data?.existingMintCompatible).toBe(false)
      expect(typeof res.body?.data?.depositEligible).toBe('boolean')
      expect(typeof res.body?.data?.redeemEligible).toBe('boolean')
      expect(String((res.body?.data?.blockers ?? []).join(' '))).toContain('No usable dynamic route runner')
      expect(String((res.body?.data?.blockers ?? []).join(' '))).toContain('missing or invalid')
    } finally {
      restoreEnv()
    }
  })

  it('reports OVault eligibility fields when compatibility hints are configured', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_ENABLED: '0',
      SOLANA_BRIDGE_CLI_DIR: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: undefined,
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_BRIDGE_TOKEN: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
      SOLANA_OVAULT_ASSET_MINT_ORIGIN: 'existing',
      SOLANA_OVAULT_TOKEN_PROGRAM: 'token-2022',
      SOLANA_OVAULT_TRANSFER_HOOK_DETECTED: 'true',
      SOLANA_OVAULT_OFT_FEE_BPS: '0',
      SOLANA_OVAULT_ADAPTER_MODE: 'regular-oft',
      SOLANA_OVAULT_AUTHORITY_COMPATIBLE: 'true',
      SOLANA_OVAULT_RENT_LAMPORTS: '2039280',
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'owner':
              return '0x8f53f8df6cf1f5be111111111111111111111111'
            case 'solanaMintToToken':
              return '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba'
            case 'scalars':
              return 1n
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
      }
      createPublicClientMock.mockReturnValue(mockPublicClient as any)

      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.existingMintCompatible).toBe(true)
      expect(res.body?.data?.depositEligible).toBe(true)
      expect(res.body?.data?.redeemEligible).toBe(true)
      expect(res.body?.data?.transferHookDetected).toBe(true)
      expect(res.body?.data?.oftFeeIsZero).toBe(true)
    } finally {
      restoreEnv()
    }
  })
})
