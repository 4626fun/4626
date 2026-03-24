import { beforeEach, describe, expect, it, vi } from 'vitest'

import familyHandler from '../deploy/[...path].ts'
import handler from '../_handlers/deploy/_registerSolanaBridgeToken.ts'
import { getDeployApiHandler } from '../_handlers/_routes.deploy.ts'
import { getApiHandler } from '../_handlers/_routes.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const INTERNAL_REGISTRATION_SECRET = 'internal-secret'

function createInternalReq(options: Parameters<typeof createMockReq>[0] = {}) {
  return createMockReq({
    ...options,
    headers: {
      'x-cv-solana-registration-secret': INTERNAL_REGISTRATION_SECRET,
      ...(options.headers ?? {}),
    },
  })
}

const {
  readDeployAuthMock,
  getApiContractsMock,
  createPublicClientMock,
  createWalletClientMock,
  privateKeyToAccountMock,
  resolveMeteoraConfigMock,
  checkRateLimitMock,
  getClientIpMock,
  rateLimitKeyMock,
  isAdminAddressMock,
} = vi.hoisted(() => ({
  readDeployAuthMock: vi.fn(),
  getApiContractsMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
  resolveMeteoraConfigMock: vi.fn(),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  getClientIpMock: vi.fn(() => '127.0.0.1'),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  isAdminAddressMock: vi.fn(() => true),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: vi.fn(async (req: any) => req.body ?? null),
}))

vi.mock('../../server/_lib/deployAuth.js', () => ({
  readDeployAuthFromRequest: readDeployAuthMock,
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: getApiContractsMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: checkRateLimitMock,
  getClientIp: getClientIpMock,
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/session.js', () => ({
  isAdminAddress: isAdminAddressMock,
}))

vi.mock('../../server/_lib/meteoraAlphaVaultConfig.js', () => ({
  resolveMeteoraAlphaVaultConfig: resolveMeteoraConfigMock,
  SOLANA_NATIVE_MINT: 'So11111111111111111111111111111111111111112',
}))

vi.mock('viem', async () => {
  const actual = await vi.importActual<any>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    createWalletClient: createWalletClientMock,
    http: vi.fn(() => ({})),
  }
})

vi.mock('viem/accounts', async () => {
  const actual = await vi.importActual<any>('viem/accounts')
  return {
    ...actual,
    privateKeyToAccount: privateKeyToAccountMock,
  }
})

describe('deploy registerSolanaBridgeToken handler', () => {
  it('is isolated from the root catch-all and dispatched through the deploy family route', async () => {
    expect(familyHandler).toBeTypeOf('function')
    await expect(getDeployApiHandler('registerSolanaBridgeToken')).resolves.toBeTypeOf('function')
    await expect(getApiHandler('deploy/registerSolanaBridgeToken')).resolves.toBeNull()
    await expect(getApiHandler('deploy/setupSolanaOvaultMesh')).resolves.toBeNull()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DEPLOY_SOLANA_REGISTRATION_SECRET = INTERNAL_REGISTRATION_SECRET
    readDeployAuthMock.mockReturnValue({ address: '0x1111111111111111111111111111111111111111' })
    isAdminAddressMock.mockReturnValue(true)
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753',
    })
    resolveMeteoraConfigMock.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    readDeployAuthMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba', buildOnly: true },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('Not authenticated')
  })

  it('returns 403 for authenticated non-admin callers', async () => {
    isAdminAddressMock.mockReturnValueOnce(false)
    const req = createMockReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Admin authorization required')
  })

  it('returns 429 when Solana registration rate limit is exceeded', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 1_000 })
    const req = createMockReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba', buildOnly: true },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Rate limit exceeded')
  })

  it('allows internal secret auth when deploy session auth is unavailable', async () => {
    const restoreEnv = applyEnv({
      DEPLOY_SOLANA_REGISTRATION_SECRET: 'internal-secret',
    })
    try {
      readDeployAuthMock.mockReturnValueOnce(null)
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return true
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
      }
      createPublicClientMock.mockReturnValue(mockPublicClient as any)

      const req = createMockReq({
        method: 'POST',
        headers: { 'x-cv-solana-registration-secret': 'internal-secret' },
        body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
      })
      const res = createMockRes()

      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.registered).toBe(true)
    } finally {
      restoreEnv()
    }
  })

  it('returns success when already registered', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          case 'solanaMintToToken':
            return '0x0000000000000000000000000000000000000000'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba', buildOnly: true },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.registered).toBe(true)
    expect(res.body?.data?.txHash).toBe(null)
    expect(createWalletClientMock).not.toHaveBeenCalled()
  })

  it('rejects mutating registration without the internal secret even for admins', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return false
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Internal Solana registration secret is required')
  })

  it('fails compatibility when transfer-hook mint uses non-zero OFT fee', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        buildOnly: true,
        assetMintOrigin: 'existing',
        enforceCompatibility: true,
        mintCompatibilityHints: {
          tokenProgram: 'token-2022',
          transferHookDetected: true,
          adapterMode: 'regular-oft',
          oftFeeBps: 10,
          authorityCompatible: true,
          rentValueLamports: '2039280',
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('OFT fee = 0')
  })

  it('fails compatibility when transfer-hook mint is configured for OFT adapter mode', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        buildOnly: true,
        assetMintOrigin: 'existing',
        enforceCompatibility: true,
        mintCompatibilityHints: {
          tokenProgram: 'token-2022',
          transferHookDetected: true,
          adapterMode: 'oft-adapter',
          oftFeeBps: 0,
          authorityCompatible: true,
          rentValueLamports: '2039280',
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(String(res.body?.error ?? '')).toContain('regular-oft mode')
  })

  it('reports existing mint eligibility when compatibility checks pass', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        buildOnly: true,
        assetMintOrigin: 'existing',
        enforceCompatibility: true,
        mintCompatibilityHints: {
          tokenProgram: 'token-2022',
          transferHookDetected: true,
          adapterMode: 'regular-oft',
          oftFeeBps: 0,
          authorityCompatible: true,
          rentValueLamports: '2039280',
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.existingMintCompatible).toBe(true)
    expect(res.body?.data?.depositEligible).toBe(true)
    expect(res.body?.data?.redeemEligible).toBe(true)
  })

  it('returns Meteora bridge ixs payload for creator-scoped build requests', async () => {
    const restoreEnv = applyEnv({
      METEORA_IX_PROVISIONER_URL: 'https://provisioner.4626.fun/meteora-ixs',
      METEORA_IX_PROVISIONER_SECRET: 'secret',
    })
    const originalFetch = globalThis.fetch
    try {
      resolveMeteoraConfigMock.mockResolvedValue({
        creatorToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        meteoraAlphaVault: '11111111111111111111111111111111',
        alphaVaultProgramId: '11111111111111111111111111111111',
        depositAccounts: [{ pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true }],
        quoteMint: SOL_MINT,
        source: 'env',
      })

      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return true
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'decimals':
              return 18
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
            success: true,
            data: {
              meteoraAlphaVault:
                '0x1111111111111111111111111111111111111111111111111111111111111111',
              solanaIxs: [
                {
                  programId: '0x2222222222222222222222222222222222222222222222222222222222222222',
                  serializedAccounts: ['0xabcdef'],
                  data: '0xdeadbeef',
                },
              ],
            },
          }),
      })) as any

      const req = createMockReq({
        method: 'POST',
        body: {
          bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
          creatorToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
          expectedSolanaAmount: '1000000000000000000',
          buildOnly: true,
        },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.meteoraAlphaVault).toBe(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
      )
      expect(Array.isArray(res.body?.data?.solanaIxs)).toBe(true)
      expect(res.body?.data?.solanaIxs?.length).toBe(1)
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })

  it('returns 409 when strict SOL pair policy sees non-SOL quote mint', async () => {
    resolveMeteoraConfigMock.mockResolvedValue({
      creatorToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
      meteoraAlphaVault: '11111111111111111111111111111111',
      alphaVaultProgramId: '11111111111111111111111111111111',
      depositAccounts: [{ pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true }],
      quoteMint: 'FG56varC4uyw8RxAswAweE7tQmjxw3vSsZmmCWkKhYuA',
      source: 'db',
    })
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async () => '0x1234'),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createMockReq({
      method: 'POST',
      body: {
        bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        creatorToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        expectedSolanaAmount: '1000000000000000000',
        buildOnly: true,
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Strict SOL pair policy is enabled')
  })

  it('returns 409 when bridge token has no deployed bytecode yet', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return false
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) =>
        String(address).toLowerCase() === '0x2414b595c4f18532a5836b6e2e6d536832c572e8' ? '0x1234' : '0x',
      ),
    }
    createPublicClientMock.mockReturnValue(mockPublicClient as any)

    const req = createInternalReq({
      method: 'POST',
      body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(409)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('has no bytecode yet')
  })

  it('registers token when missing and signer matches adapter owner', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 1n
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const req = createInternalReq({
        method: 'POST',
        body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.txHash).toBe('0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      expect(writeContractMock).toHaveBeenCalledTimes(1)
    } finally {
      restoreEnv()
    }
  })

  it('uses explicit bridgeToken when creatorToken differs', async () => {
    const bridgeToken = '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba'
    const creatorToken = '0x5b674196812451B7cEC024FE9d22D2c0b172fa75'
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      METEORA_IX_PROVISIONER_URL: 'https://provisioner.4626.fun/meteora-ixs',
      METEORA_IX_PROVISIONER_SECRET: 'secret',
    })
    const originalFetch = globalThis.fetch
    try {
      resolveMeteoraConfigMock.mockResolvedValue({
        creatorToken: creatorToken.toLowerCase(),
        meteoraAlphaVault: '11111111111111111111111111111111',
        alphaVaultProgramId: '11111111111111111111111111111111',
        depositAccounts: [{ pubkey: '11111111111111111111111111111111', isSigner: false, isWritable: true }],
        quoteMint: SOL_MINT,
        source: 'env',
      })
      const readContractMock = vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return false
          case 'owner':
            return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
          case 'solanaMintToToken':
            return '0x0000000000000000000000000000000000000000'
          case 'scalars':
            return 1n
          case 'decimals':
            return 18
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      })
      const mockPublicClient = {
        readContract: readContractMock,
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })
      ;(globalThis as any).fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: {
              meteoraAlphaVault:
                '0x1111111111111111111111111111111111111111111111111111111111111111',
              solanaIxs: [
                {
                  programId: '0x2222222222222222222222222222222222222222222222222222222222222222',
                  serializedAccounts: ['0xabcdef'],
                  data: '0xdeadbeef',
                },
              ],
            },
          }),
      })) as any

      const req = createInternalReq({
        method: 'POST',
        body: {
          bridgeToken,
          creatorToken,
          expectedSolanaAmount: '1000000000000000000',
        },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)

      const isRegisteredCall = readContractMock.mock.calls.find((call) => call[0]?.functionName === 'isRegistered')
      expect(String(isRegisteredCall?.[0]?.args?.[0] ?? '').toLowerCase()).toBe(bridgeToken.toLowerCase())

      const scalarCall = readContractMock.mock.calls.find((call) => call[0]?.functionName === 'scalars')
      expect(String(scalarCall?.[0]?.args?.[0] ?? '').toLowerCase()).toBe(bridgeToken.toLowerCase())

      const writeArgs = writeContractMock.mock.calls[0]?.[0]
      expect(writeArgs?.functionName).toBe('registerToken')
      expect(String(writeArgs?.args?.[0] ?? '').toLowerCase()).toBe(bridgeToken.toLowerCase())
      expect(String(writeArgs?.args?.[0] ?? '').toLowerCase()).not.toBe(creatorToken.toLowerCase())
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })

  it('returns 409 when base bridge route is missing for bridgeToken/mint pair', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '0',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URLS: undefined,
      SOLANA_BRIDGE_CLI_DIR: undefined,
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 0n
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
      }
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const req = createInternalReq({
        method: 'POST',
        body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(409)
      expect(String(res.body?.error ?? '')).toContain('WrappedSplRouteNotRegistered')
      expect(createWalletClientMock).not.toHaveBeenCalled()
    } finally {
      restoreEnv()
    }
  })

  it('returns 409 (not 500) when dynamic route provisioning is unavailable', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URLS: undefined,
      SOLANA_BRIDGE_CLI_DIR: '/tmp/does-not-exist',
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'name':
              return 'Creator Share'
            case 'symbol':
              return 'CSHARE'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
      }
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const req = createInternalReq({
        method: 'POST',
        body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(409)
      expect(String(res.body?.error ?? '')).toContain('Dynamic route provisioning error')
      expect(String(res.body?.error ?? '')).toContain('neither a valid local SOLANA_BRIDGE_CLI_DIR exists')
    } finally {
      restoreEnv()
    }
  })

  it('retries transient remote provisioner blockhash errors and succeeds', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: 'https://provisioner.4626.fun/provision',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_ATTEMPTS: '2',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_RETRY_DELAY_MS: '0',
      SOLANA_BRIDGE_CLI_DIR: undefined,
    })
    const originalFetch = globalThis.fetch
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 1n
            case 'name':
              return 'Creator Share'
            case 'symbol':
              return 'CSHARE'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => JSON.stringify({ error: 'Blockhash not found' }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              mintBytes32:
                '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              runner: 'remote-provisioner',
            }),
        } as any)
      ;(globalThis as any).fetch = fetchMock

      const req = createInternalReq({
        method: 'POST',
        body: { bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.solanaMint).toBe(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      )
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })

  it('forwards explicit tokenMetadataUri to remote dynamic provisioner', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: 'https://provisioner.4626.fun/provision',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_BRIDGE_CLI_DIR: undefined,
      API_HOST: 'api.4626.fun',
    })
    const originalFetch = globalThis.fetch
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 1n
            case 'name':
              return 'Creator Share'
            case 'symbol':
              return 'CSHARE'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            mintBytes32:
              '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            runner: 'remote-provisioner',
          }),
      })) as any
      ;(globalThis as any).fetch = fetchMock

      const explicitUri = 'https://cdn.4626.fun/tokens/custom-metadata.json'
      const req = createInternalReq({
        method: 'POST',
        body: {
          bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
          tokenMetadataUri: explicitUri,
        },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const fetchInit = (fetchMock.mock.calls as any[])[0]?.[1] as { body?: string } | undefined
      const sentBody = JSON.parse(String(fetchInit?.body ?? '{}')) as Record<string, unknown>
      expect(sentBody.tokenMetadataUri).toBe(explicitUri)
      expect(writeContractMock).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })

  it('derives canonical tokenMetadataUri when request omits tokenMetadataUri', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: 'https://provisioner.4626.fun/provision',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_BRIDGE_CLI_DIR: undefined,
      API_HOST: 'api.4626.fun',
    })
    const originalFetch = globalThis.fetch
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 1n
            case 'name':
              return 'Creator Share'
            case 'symbol':
              return 'CSHARE'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            mintBytes32:
              '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            runner: 'remote-provisioner',
          }),
      })) as any
      ;(globalThis as any).fetch = fetchMock

      const req = createInternalReq({
        method: 'POST',
        body: {
          bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const fetchInit = (fetchMock.mock.calls as any[])[0]?.[1] as { body?: string } | undefined
      const sentBody = JSON.parse(String(fetchInit?.body ?? '{}')) as Record<string, unknown>
      const derivedUri = String(sentBody.tokenMetadataUri ?? '')
      expect(derivedUri).toContain('https://api.4626.fun/v1/token/')
      expect(derivedUri).toContain('/metadata?chain=8453')
      expect(derivedUri.toLowerCase()).toContain(
        '/v1/token/0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba/metadata?chain=8453',
      )
      expect(writeContractMock).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })

  it('returns 400 when tokenMetadataUri has unsupported scheme', async () => {
    const req = createInternalReq({
      method: 'POST',
      body: {
        bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
        tokenMetadataUri: 'ftp://example.com/token.json',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('Invalid tokenMetadataUri')
  })

  it('uses remote provisioner mint compatibility hints for enforceCompatibility in existing-mint flow', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32: undefined,
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '1',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: 'https://provisioner.4626.fun/provision',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_SECRET: 'test-secret',
      SOLANA_BRIDGE_CLI_DIR: undefined,
    })
    const originalFetch = globalThis.fetch
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x2414b595c4f18532A5836B6e2E6d536832c572e8'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
            case 'solanaMintToToken':
              return '0x0000000000000000000000000000000000000000'
            case 'scalars':
              return 1n
            case 'name':
              return 'Creator Share'
            case 'symbol':
              return 'CSHARE'
            default:
              throw new Error(`Unexpected read ${String(args.functionName)}`)
          }
        }),
        getBytecode: vi.fn(async () => '0x1234'),
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      }
      const writeContractMock = vi.fn(async (_args: any) => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      ;(globalThis as any).fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            mintBytes32:
              '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            runner: 'remote-provisioner',
            data: {
              mintCompatibilityHints: {
                tokenProgram: 'spl-token',
                transferHookDetected: false,
                authorityCompatible: true,
                rentValueLamports: '2039280',
              },
            },
          }),
      })) as any

      const req = createInternalReq({
        method: 'POST',
        body: {
          bridgeToken: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
          assetMintOrigin: 'existing',
          enforceCompatibility: true,
        },
      })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(200)
      expect(res.body?.success).toBe(true)
      expect(res.body?.data?.existingMintCompatible).toBe(true)
      expect(res.body?.data?.depositEligible).toBe(true)
      expect(res.body?.data?.redeemEligible).toBe(true)
      expect(writeContractMock).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as any).fetch = originalFetch
      restoreEnv()
    }
  })
})
