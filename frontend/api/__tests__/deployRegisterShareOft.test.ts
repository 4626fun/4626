import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_registerShareOft.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readDeployAuthMock,
  getApiContractsMock,
  createPublicClientMock,
  createWalletClientMock,
  privateKeyToAccountMock,
  resolveMeteoraConfigMock,
} = vi.hoisted(() => ({
  readDeployAuthMock: vi.fn(),
  getApiContractsMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
  resolveMeteoraConfigMock: vi.fn(),
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

vi.mock('../../server/_lib/meteoraAlphaVaultConfig.js', () => ({
  resolveMeteoraAlphaVaultConfig: resolveMeteoraConfigMock,
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

describe('deploy registerShareOft handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readDeployAuthMock.mockReturnValue({ address: '0x1111111111111111111111111111111111111111' })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0x4184D9118ec31061cEDd6041B6bD676ac19F29a5',
    })
    resolveMeteoraConfigMock.mockResolvedValue(null)
  })

  it('returns 401 when unauthenticated', async () => {
    readDeployAuthMock.mockReturnValueOnce(null)
    const req = createMockReq({
      method: 'POST',
      body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(401)
    expect(res.body?.error).toContain('Not authenticated')
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
      body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.registered).toBe(true)
    expect(res.body?.data?.txHash).toBe(null)
    expect(createWalletClientMock).not.toHaveBeenCalled()
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
          shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba',
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

  it('returns 409 when shareOft has no deployed bytecode yet', async () => {
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

    const req = createMockReq({
      method: 'POST',
      body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
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
      const writeContractMock = vi.fn(async () => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
      createPublicClientMock.mockReturnValue(mockPublicClient as any)
      createWalletClientMock.mockReturnValue({ writeContract: writeContractMock } as any)
      privateKeyToAccountMock.mockReturnValue({
        address: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      })

      const req = createMockReq({
        method: 'POST',
        body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
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

  it('returns 409 when base bridge route is missing for shareOft/mint pair', async () => {
    const restoreEnv = applyEnv({
      SOLANA_ADAPTER_OWNER_PRIVATE_KEY:
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      SOLANA_DEFAULT_MINT_BYTES32:
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      SOLANA_DEFAULT_MINT_DECIMALS: '9',
      SOLANA_DYNAMIC_ROUTE_ENABLED: '0',
      SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL: undefined,
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

      const req = createMockReq({
        method: 'POST',
        body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
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

      const req = createMockReq({
        method: 'POST',
        body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
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
      const writeContractMock = vi.fn(async () => '0x5fcb2a505cad6c7c8bb750b95db3a846df8f181f85759750f84d91b736283557')
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

      const req = createMockReq({
        method: 'POST',
        body: { shareOft: '0x6702e7a54f1d8b190ef13b4764ba3f7d6458e9ba' },
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
})
