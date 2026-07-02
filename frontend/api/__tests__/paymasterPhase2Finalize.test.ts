import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress, keccak256, toBytes, type Address } from 'viem'

import paymasterHandler from '../_handlers/paymaster/_paymaster.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const
const CSW_IMPLEMENTATION = getAddress('0x9999999999999999999999999999999999999998')
const MOCK_BYTECODE = ('0x' + '00'.repeat(32)) as `0x${string}`
const MOCK_CODE_ID = keccak256(MOCK_BYTECODE)
const CHARM_FACTORY_SENTINEL_CODE_ID = keccak256(toBytes('charm-factory-sentinel-v1'))

const sessionAddress = getAddress('0x1111111111111111111111111111111111111111')
const protocolAjnaKeeper = getAddress('0x2222222222222222222222222222222222222222')
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
const bytecodeStore = getAddress('0x6A578022609cdb65C614FF28912C49FC1EC97071')

const {
  readRequestPrincipalMock,
  getApiContractsMock,
  isDbConfiguredMock,
  getDbMock,
  isSupabaseAdminConfiguredMock,
  readJsonBodyMock,
  mockReadContract,
  mockGetBytecode,
  mockGetLogs,
  resolveCreatorStrategyPlanMock,
  gateRequestedStrategyWeightsMock,
} = vi.hoisted(() => ({
  readRequestPrincipalMock: vi.fn(),
  getApiContractsMock: vi.fn(),
  isDbConfiguredMock: vi.fn(),
  getDbMock: vi.fn(),
  isSupabaseAdminConfiguredMock: vi.fn(),
  readJsonBodyMock: vi.fn(),
  mockReadContract: vi.fn(),
  mockGetBytecode: vi.fn(),
  mockGetLogs: vi.fn(),
  resolveCreatorStrategyPlanMock: vi.fn(async (..._args: any[]) => ({
    ok: true,
    plan: {
      isPaid: true,
      charmWeightBps: 3_000n,
      ajnaWeightBps: 3_000n,
      solanaWeightBps: 3_000n,
    },
  })),
  gateRequestedStrategyWeightsMock: vi.fn((..._args: any[]) => ({ ok: true })),
}))

vi.mock('../../server/_lib/auth/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: (...args: unknown[]) => readRequestPrincipalMock(...args),
}))

vi.mock('../../server/_lib/deploy/deploySessions.js', () => ({
  getActiveDeploySessionForSender: vi.fn(),
  getDeploySessionByTokenHash: vi.fn(),
  hashDeployToken: vi.fn(),
  signDeployToken: vi.fn(),
}))

vi.mock('../../server/_lib/onchain/contracts.js', () => ({
  getApiContracts: () => getApiContractsMock(),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  isDbConfigured: () => isDbConfiguredMock(),
  getDb: getDbMock,
  ensureCreatorWalletsSchema: vi.fn(),
  ensureCreatorAccessSchema: vi.fn(),
  ensureWaitlistSchema: vi.fn(),
}))

vi.mock('../../server/_lib/wallet/creatorWallets.js', () => ({
  ensureCreatorWalletsSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/db/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: () => isSupabaseAdminConfiguredMock(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: (...args: unknown[]) => readJsonBodyMock(...args),
}))

vi.mock('../../server/_lib/onchain/coinParties.js', () => ({
  resolveCoinParties: vi.fn(() => Promise.resolve({ creator: sessionAddress, payoutRecipient: sessionAddress })),
}))

vi.mock('../../server/_lib/creatorStrategy/resolveWeights.js', () => ({
  resolveCreatorStrategyPlan: (...args: any[]) => resolveCreatorStrategyPlanMock(...args),
  gateRequestedStrategyWeights: (...args: any[]) => gateRequestedStrategyWeightsMock(...args),
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../src/deploy/bytecode.generated.js', () => ({
  DEPLOY_BYTECODE: (() => {
    const mockBytecode = ('0x' + '00'.repeat(32)) as `0x${string}`
    return {
      CreatorOVault: mockBytecode,
      CreatorOVaultWrapper: mockBytecode,
      CreatorShareOFT: mockBytecode,
      OFTBootstrapRegistry: mockBytecode,
      CreatorGaugeController: mockBytecode,
      CCALaunchStrategy: mockBytecode,
      CreatorOracle: mockBytecode,
      PayoutRouter: mockBytecode,
      VaultShareBurnStream: mockBytecode,
      CreatorCoinPolicyController: mockBytecode,
      CreatorCharmStrategy: mockBytecode,
      CreatorOImpairmentClaims: mockBytecode,
      CreatorORecoveryEscrow: mockBytecode,
      AjnaVaultAuth: mockBytecode,
      AjnaERC4626Vault: mockBytecode,
      ERC4626StrategyAdapter: mockBytecode,
    }
  })(),
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

type ReadContractOverrides = {
  wrapperVault?: Address
  wrapperShareOFT?: Address
  wrapperCreatorCoin?: Address
  wrapperOwner?: Address | null
  shareVault?: Address
  shareOwner?: Address | null
}

function configureMockReadContract(overrides: ReadContractOverrides = {}): void {
  const resolved = {
    wrapperVault: vault,
    wrapperShareOFT: shareOFT,
    wrapperCreatorCoin: creatorToken,
    wrapperOwner: creatorVaultBatcher as Address | null,
    shareVault: vault,
    shareOwner: creatorVaultBatcher as Address | null,
    ...overrides,
  }

  mockReadContract.mockImplementation((opts: { address?: Address; functionName?: string }) => {
    const functionName = opts.functionName
    const address = opts.address ? getAddress(opts.address) : null

    if (functionName === 'isOwnerAddress') return Promise.resolve(true)
    if (functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
    if (functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
    if (functionName === 'store') return Promise.resolve(bytecodeStore)
    if (functionName === 'get') return Promise.resolve('0x60006000')
    if (functionName === 'asset') return Promise.resolve(creatorToken)
    if (functionName === 'name') return Promise.resolve('Creator OVault')
    if (functionName === 'symbol') return Promise.resolve('ovCRT')

    if (address === wrapper && functionName === 'creatorCoin') return Promise.resolve(resolved.wrapperCreatorCoin)
    if (address === wrapper && functionName === 'vault') return Promise.resolve(resolved.wrapperVault)
    if (address === wrapper && functionName === 'shareOFT') return Promise.resolve(resolved.wrapperShareOFT)
    if (address === wrapper && functionName === 'owner') return Promise.resolve(resolved.wrapperOwner)

    if (address === shareOFT && functionName === 'vault') return Promise.resolve(resolved.shareVault)
    if (address === shareOFT && functionName === 'owner') return Promise.resolve(resolved.shareOwner)

    return Promise.resolve(null)
  })
}

const BATCHER_FINALIZE_PHASE2_ABI = [
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

const COINBASE_SMART_WALLET_EXECUTE_ABI = [
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

function buildFinalizePhase2CallData(params?: {
  vault?: Address
  wrapper?: Address
  shareOFT?: Address
}): `0x${string}` {
  const finalizeData = encodeFunctionData({
    abi: BATCHER_FINALIZE_PHASE2_ABI,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken,
        owner: sender,
        vault: params?.vault ?? vault,
        wrapper: params?.wrapper ?? wrapper,
        shareOFT: params?.shareOFT ?? shareOFT,
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

  return encodeFunctionData({
    abi: COINBASE_SMART_WALLET_EXECUTE_ABI,
    functionName: 'execute',
    args: [creatorVaultBatcher, 0n, finalizeData],
  })
}

function buildPaymasterStubBody(callData: `0x${string}`): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'pm_getPaymasterStubData',
    params: [{ sender, callData, initCode: '0x' }, ENTRYPOINT_V06, 8453],
  }
}

describe('paymaster phase2 finalize selector/tuple compatibility', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
      PROTOCOL_TREASURY: sessionAddress,
      '4626_KEEPER_AUTOMATION_PUBLIC_KEY': protocolAjnaKeeper,
    })

    readRequestPrincipalMock.mockReturnValue(sessionAddress)
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher,
      vaultActivationBatcher,
      permit2,
      universalCreate2DeployerFromStore: create2Deployer,
      universalBytecodeStore: bytecodeStore,
      protocolTreasury: sessionAddress,
    })
    isDbConfiguredMock.mockReturnValue(false)
    getDbMock.mockResolvedValue(null)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockResolvedValue('0x1234')
    configureMockReadContract()
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
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])

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

  it('rejects finalizePhase2 when only approved app access exists in DB', async () => {
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])
    isDbConfiguredMock.mockReturnValue(true)
    getDbMock.mockResolvedValue({
      query: vi.fn(async (sql: string) => {
        const text = String(sql).toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from allowlist') || text.includes('select csw_address from allowlist')) {
          return { rows: [] }
        }
        if (text.includes('from creator_wallets')) {
          return { rows: [] }
        }
        if (text.includes('from profiles')) {
          return { rows: [{ id: 1 }] }
        }
        return { rows: [] }
      }),
      sql: vi.fn(),
    })

    const req = createMockReq({
      method: 'POST',
      body: buildPaymasterStubBody(buildFinalizePhase2CallData()),
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')

    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/vault allowlist required/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('rejects finalizePhase2 when wrapper.vault does not match expected vault', async () => {
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])
    configureMockReadContract({
      wrapperVault: getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    })

    const req = createMockReq({
      method: 'POST',
      body: buildPaymasterStubBody(buildFinalizePhase2CallData()),
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')

    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/wrapper_vault_mismatch/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('rejects finalizePhase2 when shareOFT.vault does not match expected vault', async () => {
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])
    configureMockReadContract({
      shareVault: getAddress('0xcccccccccccccccccccccccccccccccccccccccc'),
    })

    const req = createMockReq({
      method: 'POST',
      body: buildPaymasterStubBody(buildFinalizePhase2CallData()),
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')

    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/shareoft_vault_mismatch/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('accepts finalizePhase2WithPermit2 with current tuple shape', async () => {
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])

    const BATCHER_ABI = [
      {
        type: 'function',
        name: 'finalizePhase2WithPermit2',
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
          {
            name: 'permit',
            type: 'tuple',
            components: [
              {
                name: 'permitted',
                type: 'tuple',
                components: [
                  { name: 'token', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                ],
              },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          },
          { name: 'signature', type: 'bytes' },
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
      functionName: 'finalizePhase2WithPermit2',
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
        {
          permitted: { token: creatorToken, amount: 5_000_000n * 10n ** 18n },
          nonce: 1n,
          deadline: 1_900_000_000n,
        },
        '0x1234',
      ],
    })

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
    isDbConfiguredMock.mockReturnValue(true)
    getDbMock.mockResolvedValue({
      query: vi.fn(async (sql: string) => {
        const text = String(sql).toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from allowlist') && text.includes('select address')) {
          return { rows: [{ address: sessionAddress }] }
        }
        if (text.includes('select csw_address from allowlist')) {
          return { rows: [] }
        }
        if (text.includes('from profile_wallets')) return { rows: [] }
        if (text.includes('from profiles')) return { rows: [{ id: 1 }] }
        return { rows: [] }
      }),
      sql: vi.fn(async () => ({ rows: [] })),
    })

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
              { name: 'ajnaVaultName', type: 'string' },
              { name: 'ajnaVaultSymbol', type: 'string' },
              { name: 'charmWeightBps', type: 'uint256' },
              { name: 'ajnaWeightBps', type: 'uint256' },
              { name: 'solanaWeightBps', type: 'uint256' },
              { name: 'ajnaBufferRatioBps', type: 'uint256' },
              { name: 'ajnaMinBucketIndex', type: 'uint256' },
              { name: 'ajnaKeeper', type: 'address' },
              { name: 'solanaKeeper', type: 'address' },
              { name: 'solanaMaxNavAge', type: 'uint64' },
              { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
              { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
              { name: 'solanaBridgeAddress', type: 'address' },
              { name: 'enableAutoAllocate', type: 'bool' },
              { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
            ],
          },
          {
            name: 'codeIds',
            type: 'tuple',
            components: [
              { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
              { name: 'creatorCharmStrategy', type: 'bytes32' },
              { name: 'ajnaVaultAuth', type: 'bytes32' },
              { name: 'ajnaVault', type: 'bytes32' },
              { name: 'erc4626StrategyAdapter', type: 'bytes32' },
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
          ajnaVaultName: 'Ajna Inner Vault',
          ajnaVaultSymbol: 'aCRT',
          charmWeightBps: 3_000n,
          ajnaWeightBps: 3_000n,
          solanaWeightBps: 3_000n,
          ajnaBufferRatioBps: 1_000n,
          ajnaMinBucketIndex: 4_156n,
          ajnaKeeper: protocolAjnaKeeper,
          solanaKeeper: sessionAddress,
          solanaMaxNavAge: 86_400n,
          solanaMaxNavDeltaBpsPerUpdate: 500,
          solanaMinBaseLiquidityBps: 100,
          solanaBridgeAddress: sender,
          enableAutoAllocate: false,
          expectedCharmProtocolFeePips: 10_000,
        },
        {
          charmAlphaVaultDeploy: CHARM_FACTORY_SENTINEL_CODE_ID,
          creatorCharmStrategy: MOCK_CODE_ID,
          ajnaVaultAuth: MOCK_CODE_ID,
          ajnaVault: MOCK_CODE_ID,
          erc4626StrategyAdapter: MOCK_CODE_ID,
          solanaStrategy: MOCK_CODE_ID,
        },
      ],
    })

    expect(phase3Data.slice(0, 10).toLowerCase()).toBe('0x881d4960')

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

  it('accepts launchDeferredAuction with current selector', async () => {
    const BATCHER_ABI = [
      {
        type: 'function',
        name: 'launchDeferredAuction',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'params',
            type: 'tuple',
            components: [
              { name: 'creatorToken', type: 'address' },
              { name: 'owner', type: 'address' },
              { name: 'shareOFT', type: 'address' },
              { name: 'version', type: 'string' },
              { name: 'floorPriceQ96', type: 'uint256' },
              { name: 'requiredRaise', type: 'uint128' },
              { name: 'auctionSteps', type: 'bytes' },
            ],
          },
        ],
        outputs: [{ name: 'auction', type: 'address' }],
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

    const launchData = encodeFunctionData({
      abi: BATCHER_ABI,
      functionName: 'launchDeferredAuction',
      args: [
        {
          creatorToken,
          owner: sender,
          shareOFT,
          version: 'v1',
          floorPriceQ96: 1_000_000n,
          requiredRaise: 100_000_000_000_000_000n,
          auctionSteps: '0x',
        },
      ],
    })

    expect(launchData.slice(0, 10).toLowerCase()).toBe('0x02afdbcb')

    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [creatorVaultBatcher, 0n, launchData],
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

  it('accepts phase3 runtime vault calls after deployPhase3Strategies', async () => {
    isDbConfiguredMock.mockReturnValue(true)
    getDbMock.mockResolvedValue({
      query: vi.fn(async (sql: string) => {
        const text = String(sql).toLowerCase().replace(/\s+/g, ' ')
        if (text.includes('from allowlist') && text.includes('select address')) {
          return { rows: [{ address: sessionAddress }] }
        }
        if (text.includes('select csw_address from allowlist')) {
          return { rows: [] }
        }
        if (text.includes('from profile_wallets')) return { rows: [] }
        if (text.includes('from profiles')) return { rows: [{ id: 1 }] }
        return { rows: [] }
      }),
      sql: vi.fn(async () => ({ rows: [] })),
    })

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
              { name: 'ajnaVaultName', type: 'string' },
              { name: 'ajnaVaultSymbol', type: 'string' },
              { name: 'charmWeightBps', type: 'uint256' },
              { name: 'ajnaWeightBps', type: 'uint256' },
              { name: 'solanaWeightBps', type: 'uint256' },
              { name: 'ajnaBufferRatioBps', type: 'uint256' },
              { name: 'ajnaMinBucketIndex', type: 'uint256' },
              { name: 'ajnaKeeper', type: 'address' },
              { name: 'solanaKeeper', type: 'address' },
              { name: 'solanaMaxNavAge', type: 'uint64' },
              { name: 'solanaMaxNavDeltaBpsPerUpdate', type: 'uint16' },
              { name: 'solanaMinBaseLiquidityBps', type: 'uint16' },
              { name: 'solanaBridgeAddress', type: 'address' },
              { name: 'enableAutoAllocate', type: 'bool' },
              { name: 'expectedCharmProtocolFeePips', type: 'uint24' },
            ],
          },
          {
            name: 'codeIds',
            type: 'tuple',
            components: [
              { name: 'charmAlphaVaultDeploy', type: 'bytes32' },
              { name: 'creatorCharmStrategy', type: 'bytes32' },
              { name: 'ajnaVaultAuth', type: 'bytes32' },
              { name: 'ajnaVault', type: 'bytes32' },
              { name: 'erc4626StrategyAdapter', type: 'bytes32' },
              { name: 'solanaStrategy', type: 'bytes32' },
            ],
          },
        ],
        outputs: [],
      },
    ] as const

    const VAULT_RUNTIME_ABI = [
      {
        type: 'function',
        name: 'setMinimumTotalIdle',
        stateMutability: 'nonpayable',
        inputs: [{ name: '_minimumTotalIdle', type: 'uint256' }],
        outputs: [],
      },
      {
        type: 'function',
        name: 'deployToStrategies',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
      },
    ] as const

    const COINBASE_SMART_WALLET_BATCH_ABI = [
      {
        type: 'function',
        name: 'executeBatch',
        stateMutability: 'nonpayable',
        inputs: [
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'target', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
            ],
          },
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
          ajnaVaultName: 'Ajna Inner Vault',
          ajnaVaultSymbol: 'aCRT',
          charmWeightBps: 3_000n,
          ajnaWeightBps: 3_000n,
          solanaWeightBps: 3_000n,
          ajnaBufferRatioBps: 1_000n,
          ajnaMinBucketIndex: 4_156n,
          ajnaKeeper: protocolAjnaKeeper,
          solanaKeeper: sessionAddress,
          solanaMaxNavAge: 86_400n,
          solanaMaxNavDeltaBpsPerUpdate: 500,
          solanaMinBaseLiquidityBps: 100,
          solanaBridgeAddress: sender,
          enableAutoAllocate: false,
          expectedCharmProtocolFeePips: 10_000,
        },
        {
          charmAlphaVaultDeploy: CHARM_FACTORY_SENTINEL_CODE_ID,
          creatorCharmStrategy: MOCK_CODE_ID,
          ajnaVaultAuth: MOCK_CODE_ID,
          ajnaVault: MOCK_CODE_ID,
          erc4626StrategyAdapter: MOCK_CODE_ID,
          solanaStrategy: MOCK_CODE_ID,
        },
      ],
    })

    const setMinimumIdleData = encodeFunctionData({
      abi: VAULT_RUNTIME_ABI,
      functionName: 'setMinimumTotalIdle',
      args: [500_000n * 10n ** 18n],
    })
    const deployToStrategiesData = encodeFunctionData({
      abi: VAULT_RUNTIME_ABI,
      functionName: 'deployToStrategies',
      args: [],
    })

    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_BATCH_ABI,
      functionName: 'executeBatch',
      args: [
        [
          { target: creatorVaultBatcher, value: 0n, data: phase3Data },
          { target: vault, value: 0n, data: setMinimumIdleData },
          { target: vault, value: 0n, data: deployToStrategiesData },
        ],
      ],
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

  it('rejects legacy direct-Ajna deployPhase3Strategies selector', async () => {
    const LEGACY_BATCHER_ABI = [
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

    const phase3Data = encodeFunctionData({
      abi: LEGACY_BATCHER_ABI,
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
          solanaMaxNavAge: 86_400n,
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

    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/batcher_selector_not_allowed/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })
})
