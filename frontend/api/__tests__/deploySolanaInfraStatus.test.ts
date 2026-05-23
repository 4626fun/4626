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

vi.mock('../../server/_lib/auth/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/onchain/contracts.js', () => ({
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
    const restoreEnv = applyEnv({
      KPR_API_KEY: undefined,
      DEPLOY_SOLANA_REGISTRATION_SECRET: undefined,
      SOLANA_REGISTRATION_INTERNAL_SECRET: undefined,
    })
    try {
      getSessionAddressMock.mockReturnValueOnce(null)
      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(401)
      expect(String(res.body?.error ?? '')).toContain('Sign in required')
    } finally {
      restoreEnv()
    }
  })

  it('allows machine auth via KPR_API_KEY when session is missing', async () => {
    const restoreEnv = applyEnv({
      KPR_API_KEY: 'test-keepr-key',
      DEPLOY_SOLANA_REGISTRATION_SECRET: undefined,
      SOLANA_REGISTRATION_INTERNAL_SECRET: undefined,
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
      SOLANA_OVAULT_TOKEN_PROGRAM: 'spl-token',
      SOLANA_OVAULT_TRANSFER_HOOK_DETECTED: 'false',
      SOLANA_OVAULT_AUTHORITY_COMPATIBLE: 'true',
      SOLANA_OVAULT_RENT_LAMPORTS: '2039280',
    })
    try {
      getSessionAddressMock.mockReturnValueOnce(null)
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'
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

      const req = createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer test-keepr-key' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.admin).toBe('0x0000000000000000000000000000000000000000')
    } finally {
      restoreEnv()
    }
  })

  it('reports dynamic runner misconfiguration and invalid signer key', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_BRIDGE_CLI_DIR: '/definitely/missing/path',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: undefined,
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY: 'not-a-hex-private-key',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      KPR_PRIVATE_KEY: undefined,
      PRIVATE_KEY: undefined,
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'
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
              return '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'
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

  it('surfaces canonical allowlist + liveness blockers in status payload', async () => {
    const restoreEnv = applyEnv({
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_BRIDGE_CLI_DIR: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: 'https://provisioner.4626.fun/provision',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_HEALTH_URL: 'https://provisioner.4626.fun/healthz',
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_BRIDGE_TOKEN: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
      SOLANA_OVAULT_ASSET_MINT_ORIGIN: 'existing',
      SOLANA_OVAULT_TOKEN_PROGRAM: 'spl-token',
      SOLANA_OVAULT_TRANSFER_HOOK_DETECTED: 'false',
      SOLANA_OVAULT_AUTHORITY_COMPATIBLE: 'true',
      SOLANA_OVAULT_RENT_LAMPORTS: '2039280',
      SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST_REQUIRED: '1',
      SOLANA_CANONICAL_BRIDGE_TOKEN_ALLOWLIST: '',
      SOLANA_BRIDGE_LIVENESS_ENFORCED: '1',
      SOLANA_BRIDGE_LIVENESS_MAX_HEALTH_AGE_SECONDS: '60',
    })
    const originalFetch = globalThis.fetch
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x700b4BBAf965c013123bAd02a6562FBa487aC0f1'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
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
      ;(globalThis as any).fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            ok: true,
            payerConfigured: true,
            payerHealthy: true,
            now: new Date(Date.now() - 10 * 60_000).toISOString(),
          }),
      })) as any

      const req = createMockReq({ method: 'GET' })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.canonicalBridgeTokenAllowlistRequired).toBe(true)
      expect(res.body?.data?.defaultRouteBridgeTokenAllowlisted).toBe(false)
      expect(res.body?.data?.bridgeLivenessEnforced).toBe(true)
      expect(res.body?.data?.bridgeLivenessHealthy).toBe(false)
      expect(res.body?.data?.readyForAutoRegistration).toBe(false)
      const blockers = String((res.body?.data?.blockers ?? []).join(' '))
      expect(blockers).toContain('Canonical bridge token allowlist is required')
      expect(blockers).toContain('Bridge liveness: Remote Solana provisioner health payload is stale')
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })
})
