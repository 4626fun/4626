import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress, type Address } from 'viem'

import paymasterHandler from '../_handlers/paymaster/_paymaster.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
const CSW_IMPLEMENTATION = getAddress('0x9999999999999999999999999999999999999998')

const sessionAddress = getAddress('0x1111111111111111111111111111111111111111')
const sender = getAddress('0x3333333333333333333333333333333333333333')
const creatorToken = getAddress('0x4444444444444444444444444444444444444444')
const legacyVault = getAddress('0x5555555555555555555555555555555555555555')
const legacyWrapper = getAddress('0x6666666666666666666666666666666666666666')
const legacyShareOFT = getAddress('0x7777777777777777777777777777777777777777')

const creatorVaultBatcher = getAddress('0xB87CBb646dD14F520078F11196f79BF815F18c84')
const vaultActivationBatcher = getAddress('0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB')
const permit2 = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3')
const create2Deployer = getAddress('0x74183076C7D33346880A5bf0e263B761FB4d38BA')
const bytecodeStore = getAddress('0x6A578022609cdb65C614FF28912C49FC1EC97071')

const readRequestPrincipalMock = vi.fn()
const getApiContractsMock = vi.fn()
const isDbConfiguredMock = vi.fn()
const isSupabaseAdminConfiguredMock = vi.fn()
const readJsonBodyMock = vi.fn()

const mockReadContract = vi.fn()
const mockGetBytecode = vi.fn()
const mockGetLogs = vi.fn()

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
  getDb: vi.fn(),
  ensureCreatorWalletsSchema: vi.fn(),
  ensureCreatorAccessSchema: vi.fn(),
  ensureWaitlistSchema: vi.fn(),
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

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../src/deploy/bytecode.generated.js', () => ({
  DEPLOY_BYTECODE: {
    CreatorOVault: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorOVaultWrapper: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorShareOFT: ('0x' + '00'.repeat(32)) as `0x${string}`,
    OFTBootstrapRegistry: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorGaugeController: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CCALaunchStrategy: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorOracle: ('0x' + '00'.repeat(32)) as `0x${string}`,
    PayoutRouter: ('0x' + '00'.repeat(32)) as `0x${string}`,
    VaultShareBurnStream: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorCoinPolicyController: ('0x' + '00'.repeat(32)) as `0x${string}`,
    CreatorCharmStrategy: ('0x' + '00'.repeat(32)) as `0x${string}`,
    AjnaVaultAuth: ('0x' + '00'.repeat(32)) as `0x${string}`,
    AjnaERC4626Vault: ('0x' + '00'.repeat(32)) as `0x${string}`,
    ERC4626StrategyAdapter: ('0x' + '00'.repeat(32)) as `0x${string}`,
    SolanaStrategy: ('0x' + '00'.repeat(32)) as `0x${string}`,
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

describe('paymaster legacy withdraw provenance', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
      PROTOCOL_TREASURY: sessionAddress,
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
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockResolvedValue('0x1234')
    mockReadContract.mockImplementation((opts: { address?: Address; functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
      if (opts.functionName === 'asset') return Promise.resolve(creatorToken)
      if (opts.functionName === 'store') return Promise.resolve(bytecodeStore)
      return Promise.resolve(null)
    })
    mockGetLogs.mockResolvedValue([{ args: { vault: legacyVault } }])

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })),
    }) as typeof fetch
  })

  afterEach(() => {
    restoreEnv()
    globalThis.fetch = originalFetch
  })

  function buildLegacyRedeemUserOp() {
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

    // legacy selector whitelist includes redeem(uint256,address,address)
    const legacyRedeemCallData = '0xba087652' as `0x${string}`
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [legacyVault, 0n, legacyRedeemCallData],
    })

    return {
      sender,
      callData,
      initCode: '0x',
    }
  }

  function buildLegacyUnwrapUserOp() {
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

    const legacyUnwrapCallData = '0xde0e9a3e' as `0x${string}`
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'execute',
      args: [legacyWrapper, 0n, legacyUnwrapCallData],
    })

    return {
      sender,
      callData,
      initCode: '0x',
    }
  }

  it('allows legacy withdraw flow when vault provenance matches a Phase1Deployed event', async () => {
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [buildLegacyRedeemUserOp(), ENTRYPOINT_V06, 8453],
    }

    const req = createMockReq({
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).not.toMatch(/request denied/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(1)
  })

  it('denies legacy withdraw flow when vault provenance has no Phase1Deployed match', async () => {
    mockGetLogs.mockResolvedValue([])

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [buildLegacyRedeemUserOp(), ENTRYPOINT_V06, 8453],
    }

    const req = createMockReq({
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/legacy_vault_provenance_mismatch/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('denies legacy unwrap flow when wrapper creator token mismatches vault asset', async () => {
    const wrongCreatorToken = getAddress('0x8888888888888888888888888888888888888888')
    mockReadContract.mockImplementation((opts: { address?: Address; functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
      if (opts.functionName === 'asset') return Promise.resolve(creatorToken)
      if (opts.functionName === 'store') return Promise.resolve(bytecodeStore)
      if (opts.address === legacyWrapper && opts.functionName === 'vault') return Promise.resolve(legacyVault)
      if (opts.address === legacyWrapper && opts.functionName === 'shareOFT') return Promise.resolve(legacyShareOFT)
      if (opts.address === legacyWrapper && opts.functionName === 'creatorCoin') return Promise.resolve(wrongCreatorToken)
      if (opts.address === legacyWrapper && opts.functionName === 'owner') return Promise.resolve(creatorVaultBatcher)
      if (opts.address === legacyShareOFT && opts.functionName === 'vault') return Promise.resolve(legacyVault)
      if (opts.address === legacyShareOFT && opts.functionName === 'owner') return Promise.resolve(creatorVaultBatcher)
      return Promise.resolve(null)
    })
    mockGetLogs.mockResolvedValue([
      { args: { vault: legacyVault, wrapper: legacyWrapper, shareOFT: legacyShareOFT } },
    ])

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [buildLegacyUnwrapUserOp(), ENTRYPOINT_V06, 8453],
    }

    const req = createMockReq({
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/legacy_wrapper_creator_token_mismatch/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })

  it('denies legacy unwrap flow when share OFT owner is not the batcher', async () => {
    const unexpectedOwner = getAddress('0x9999999999999999999999999999999999999999')
    mockReadContract.mockImplementation((opts: { address?: Address; functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
      if (opts.functionName === 'asset') return Promise.resolve(creatorToken)
      if (opts.functionName === 'store') return Promise.resolve(bytecodeStore)
      if (opts.address === legacyWrapper && opts.functionName === 'vault') return Promise.resolve(legacyVault)
      if (opts.address === legacyWrapper && opts.functionName === 'shareOFT') return Promise.resolve(legacyShareOFT)
      if (opts.address === legacyWrapper && opts.functionName === 'creatorCoin') return Promise.resolve(creatorToken)
      if (opts.address === legacyWrapper && opts.functionName === 'owner') return Promise.resolve(creatorVaultBatcher)
      if (opts.address === legacyShareOFT && opts.functionName === 'vault') return Promise.resolve(legacyVault)
      if (opts.address === legacyShareOFT && opts.functionName === 'owner') return Promise.resolve(unexpectedOwner)
      return Promise.resolve(null)
    })
    mockGetLogs.mockResolvedValue([
      { args: { vault: legacyVault, wrapper: legacyWrapper, shareOFT: legacyShareOFT } },
    ])

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [buildLegacyUnwrapUserOp(), ENTRYPOINT_V06, 8453],
    }

    const req = createMockReq({
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/legacy_shareoft_owner_mismatch/i)
    expect((globalThis.fetch as any).mock.calls.length).toBe(0)
  })
})
