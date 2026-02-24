import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress } from 'viem'

import paymasterHandler from '../_handlers/_paymaster.ts'
import { createMockReq, createMockRes } from './helpers'
import { applyEnv } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')

const sessionAddress = getAddress('0x1111111111111111111111111111111111111111')
const sessionOwner = getAddress('0x2222222222222222222222222222222222222222')
const sender = getAddress('0x3333333333333333333333333333333333333333')

const readRequestPrincipalMock = vi.fn()
const getActiveDeploySessionMock = vi.fn()
const getApiContractsMock = vi.fn()
const isDbConfiguredMock = vi.fn()
const isSupabaseAdminConfiguredMock = vi.fn()
const readJsonBodyMock = vi.fn()

const mockReadContract = vi.fn()
const mockGetBytecode = vi.fn()
const mockGetLogs = vi.fn()

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: (...args: unknown[]) => readRequestPrincipalMock(...args),
}))

vi.mock('../../server/_lib/deploySessions.js', () => ({
  getActiveDeploySessionForSender: (...args: unknown[]) => getActiveDeploySessionMock(...args),
  getDeploySessionByTokenHash: vi.fn(),
  hashDeployToken: vi.fn(),
  signDeployToken: vi.fn(),
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: () => getApiContractsMock(),
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: vi.fn(),
  ensureCreatorWalletsSchema: vi.fn(),
  ensureCreatorAccessSchema: vi.fn(),
  ensureWaitlistSchema: vi.fn(),
}))

vi.mock('../../server/_lib/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: () => isSupabaseAdminConfiguredMock(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: (req: { body?: unknown }) => readJsonBodyMock(req),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: vi.fn(() => Promise.resolve({ creator: sessionOwner, payoutRecipient: sessionOwner })),
}))

vi.mock('../../server/_lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../src/deploy/bytecode.generated.js', () => ({
  DEPLOY_BYTECODE: {
    PayoutRouter: ('0x' + '00'.repeat(32)) as `0x${string}`,
    VaultShareBurnStream: ('0x' + '00'.repeat(32)) as `0x${string}`,
  },
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBytecode: mockGetBytecode,
      readContract: mockReadContract,
      getLogs: mockGetLogs,
    })),
    http: vi.fn(() => ({})),
  }
})

vi.mock('viem/chains', () => ({
  base: {},
}))

// Must be before dynamic import of viem in getBaseClient
const originalFetch = globalThis.fetch

describe('paymaster deploy-session setup (selfcall-only)', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
    })

    readRequestPrincipalMock.mockReturnValue(sessionAddress)
    getActiveDeploySessionMock.mockResolvedValue({ sessionOwner })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0xB87CBb646dD14F520078F11196f79BF815F18c84',
      vaultActivationBatcher: '0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      universalCreate2DeployerFromStore: '0x74183076C7D33346880A5bf0e263B761FB4d38BA',
      universalBytecodeStore: '0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13',
    })
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockResolvedValue('0x1234')
    mockReadContract.mockImplementation((opts: { functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'store') return Promise.resolve('0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13')
      return Promise.resolve(null)
    })
    mockGetLogs.mockResolvedValue([])

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })),
    }) as typeof fetch
  })

  afterEach(() => {
    restoreEnv()
    globalThis.fetch = originalFetch
  })

  it('accepts addOwnerAddress self-call when it matches active deploy session owner', async () => {
    const COINBASE_SMART_WALLET_ABI = [
      {
        type: 'function',
        name: 'execute',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'target', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
        outputs: [],
      },
    ] as const
    const COINBASE_SMART_WALLET_OWNER_MGMT_ABI = [
      {
        type: 'function',
        name: 'addOwnerAddress',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [],
      },
    ] as const

    const innerData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_OWNER_MGMT_ABI,
      functionName: 'addOwnerAddress',
      args: [sessionOwner],
    })
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [sender, 0n, innerData],
    })

    const userOp = {
      sender,
      callData,
      initCode: '0x',
    }

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [userOp, ENTRYPOINT_V06, 8453],
    }

    const req = createMockReq({
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = responseBody?.error?.message ?? ''
    expect(errMsg).not.toMatch(/request denied/i)
    expect(errMsg).not.toMatch(/missing_primary_call/i)
  })
})
