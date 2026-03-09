import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress, type Address } from 'viem'

import paymasterHandler from '../_handlers/_paymaster.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const

const sessionAddress = getAddress('0x1111111111111111111111111111111111111111')
const sender = getAddress('0x3333333333333333333333333333333333333333')
const creatorToken = getAddress('0x4444444444444444444444444444444444444444')
const vault = getAddress('0x5555555555555555555555555555555555555555')
const wrapper = getAddress('0x6666666666666666666666666666666666666666')
const shareOFT = getAddress('0x7777777777777777777777777777777777777777')
const gaugeController = getAddress('0x8888888888888888888888888888888888888888')
const ccaStrategy = getAddress('0x9999999999999999999999999999999999999999')
const oracle = getAddress('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')

const creatorVaultBatcher = getAddress('0xB87CBb646dD14F520078F11196f79BF815F18c84')
const vaultActivationBatcher = getAddress('0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB')
const permit2 = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3')
const create2Deployer = getAddress('0x74183076C7D33346880A5bf0e263B761FB4d38BA')
const bytecodeStore = getAddress('0x1268f550E794e235e4eFCE7B2D3fd7a30bb62d13')

const readRequestPrincipalMock = vi.fn()
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
  getActiveDeploySessionForSender: vi.fn(),
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
  resolveCoinParties: vi.fn(() => Promise.resolve({ creator: sessionAddress, payoutRecipient: sessionAddress })),
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

const originalFetch = globalThis.fetch

describe('paymaster phase2 finalize selector/tuple compatibility', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
    })

    readRequestPrincipalMock.mockReturnValue(sessionAddress)
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher,
      vaultActivationBatcher,
      permit2,
      universalCreate2DeployerFromStore: create2Deployer,
      universalBytecodeStore: bytecodeStore,
    })
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockResolvedValue('0x1234')
    mockReadContract.mockImplementation((opts: { address?: Address; functionName?: string }) => {
      const functionName = opts.functionName
      const address = opts.address ? getAddress(opts.address) : null

      if (functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (functionName === 'store') return Promise.resolve(bytecodeStore)
      if (functionName === 'get') return Promise.resolve('0x60006000')
      if (functionName === 'asset') return Promise.resolve(creatorToken)
      if (functionName === 'name') return Promise.resolve('Creator OVault')
      if (functionName === 'symbol') return Promise.resolve('ovCRT')

      if (address === wrapper && functionName === 'creatorCoin') return Promise.resolve(creatorToken)
      if (address === wrapper && functionName === 'vault') return Promise.resolve(vault)
      if (address === wrapper && functionName === 'shareOFT') return Promise.resolve(shareOFT)
      if (address === wrapper && functionName === 'owner') return Promise.resolve(creatorVaultBatcher)

      if (address === shareOFT && functionName === 'vault') return Promise.resolve(vault)
      if (address === shareOFT && functionName === 'owner') return Promise.resolve(creatorVaultBatcher)

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

  it('accepts finalizePhase2 with current tuple shape and selector', async () => {
    const BATCHER_ABI = [
      {
        type: 'function',
        name: 'finalizePhase2',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'creatorToken', type: 'address' },
              { name: 'owner', type: 'address' },
              { name: 'vault', type: 'address' },
              { name: 'wrapper', type: 'address' },
              { name: 'shareOFT', type: 'address' },
              { name: 'gaugeController', type: 'address' },
              { name: 'ccaStrategy', type: 'address' },
              { name: 'oracle', type: 'address' },
              { name: 'version', type: 'string' },
              { name: 'depositAmount', type: 'uint256' },
              { name: 'requiredRaise', type: 'uint128' },
              { name: 'floorPriceQ96', type: 'uint256' },
              { name: 'auctionSteps', type: 'bytes' },
              { name: 'meteoraAlphaVault', type: 'bytes32' },
              {
                name: 'solanaIxs',
                type: 'tuple[]',
                components: [
                  { name: 'programId', type: 'bytes32' },
                  { name: 'serializedAccounts', type: 'bytes[]' },
                  { name: 'data', type: 'bytes' },
                ],
              },
            ],
          },
        ],
        outputs: [],
      },
    ] as const

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

    const finalizeData = encodeFunctionData({
      abi: BATCHER_ABI,
      functionName: 'finalizePhase2',
      args: [
        {
          creatorToken,
          owner: sender,
          vault,
          wrapper,
          shareOFT,
          gaugeController,
          ccaStrategy,
          oracle,
          version: 'v1',
          depositAmount: 5_000_000n * 10n ** 18n,
          requiredRaise: 100_000_000_000_000_000n,
          floorPriceQ96: 1_000_000n,
          auctionSteps: '0x',
          meteoraAlphaVault: ZERO_BYTES32,
          solanaIxs: [],
        },
      ],
    })

    expect(finalizeData.slice(0, 10).toLowerCase()).toBe('0xbd4583fb')

    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [creatorVaultBatcher, 0n, finalizeData],
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
    expect((globalThis.fetch as any).mock.calls.length).toBe(1)
  })

  it('accepts deployPhase3Strategies with current selector', async () => {
    const BATCHER_ABI = [
      {
        type: 'function',
        name: 'deployPhase3Strategies',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'creatorToken', type: 'address' },
              { name: 'owner', type: 'address' },
              { name: 'vault', type: 'address' },
              { name: 'version', type: 'string' },
              { name: 'initialSqrtPriceX96', type: 'uint160' },
              { name: 'charmVaultName', type: 'string' },
              { name: 'charmVaultSymbol', type: 'string' },
              { name: 'charmWeightBps', type: 'uint256' },
              { name: 'ajnaWeightBps', type: 'uint256' },
              { name: 'solanaWeightBps', type: 'uint256' },
              { name: 'solanaKeeper', type: 'address' },
              { name: 'solanaMaxNavAge', type: 'uint64' },
              { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
              { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
              { name: 'solanaBridgeAddress', type: 'address' },
              { name: 'enableAutoAllocate', type: 'bool' },
            ],
          },
          {
            name: 'codeIds',
            type: 'tuple',
            components: [
              { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
              { name: 'creatorCharmStrategy', type: 'bytes32' },
              { name: 'ajnaStrategy', type: 'bytes32' },
              { name: 'solanaStrategy', type: 'bytes32' },
            ],
          },
        ],
        outputs: [],
      },
    ] as const

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

    mockGetLogs.mockResolvedValue([{ args: { vault } }])

    const phase3Data = encodeFunctionData({
      abi: BATCHER_ABI,
      functionName: 'deployPhase3Strategies',
      args: [
        {
          creatorToken,
          owner: sender,
          vault,
          version: 'v1',
          initialSqrtPriceX96: 1n,
          charmVaultName: 'Charm',
          charmVaultSymbol: 'CHARM',
          charmWeightBps: 3_000n,
          ajnaWeightBps: 3_000n,
          solanaWeightBps: 3_000n,
          solanaKeeper: sender,
          solanaMaxNavAge: 86_400,
          solanaMaxNavDeltaBpsPerUpdate: 500,
          solanaMinBaseLiquidityBps: 100,
          solanaBridgeAddress: sender,
          enableAutoAllocate: false,
        },
        {
          charmAlphaVaultDeploy: ZERO_BYTES32,
          creatorCharmStrategy: ZERO_BYTES32,
          ajnaStrategy: ZERO_BYTES32,
          solanaStrategy: ZERO_BYTES32,
        },
      ],
    })

    expect(phase3Data.slice(0, 10).toLowerCase()).toBe('0x1d39c22c')

    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [creatorVaultBatcher, 0n, phase3Data],
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
    expect((globalThis.fetch as any).mock.calls.length).toBe(1)
  })
})
