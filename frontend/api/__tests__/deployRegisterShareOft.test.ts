import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/_registerShareOft.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readDeployAuthMock,
  getApiContractsMock,
  createPublicClientMock,
  createWalletClientMock,
  privateKeyToAccountMock,
} = vi.hoisted(() => ({
  readDeployAuthMock: vi.fn(),
  getApiContractsMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
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
      creatorVaultBatcher: '0x32e91185B92c6c13dd56D745aBf24F009cdD3019',
    })
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
            return '0x5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return true
          case 'owner':
            return '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80'
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

  it('returns 409 when shareOft has no deployed bytecode yet', async () => {
    const mockPublicClient = {
      readContract: vi.fn(async (args: any) => {
        switch (args.functionName) {
          case 'solanaBridgeAdapter':
            return '0x5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92'
          case 'solanaDestination':
            return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
          case 'isRegistered':
            return false
          case 'owner':
            return '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80'
          default:
            throw new Error(`Unexpected read ${String(args.functionName)}`)
        }
      }),
      getBytecode: vi.fn(async ({ address }: any) =>
        String(address).toLowerCase() === '0x5d0e33a4dfaa4e1eb4bdf41b953baa03ca73ea92' ? '0x1234' : '0x',
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
              return '0x5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80'
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
        address: '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80',
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
    })
    try {
      const mockPublicClient = {
        readContract: vi.fn(async (args: any) => {
          switch (args.functionName) {
            case 'solanaBridgeAdapter':
              return '0x5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92'
            case 'solanaDestination':
              return '0x7d076c0e9f957d83a16d58370df29fc679069cf902dfb47ce06fd2507218ff2c'
            case 'isRegistered':
              return false
            case 'owner':
              return '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80'
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
        address: '0xd836414eF13a165cC5Ba63De10b4a46b8d1F5A80',
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
})
