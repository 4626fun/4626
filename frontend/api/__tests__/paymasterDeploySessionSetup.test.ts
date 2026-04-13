import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem'

import paymasterHandler from '../_handlers/_paymaster.ts'
import { createMockReq, createMockRes } from './helpers'
import { applyEnv } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')
const CSW_IMPLEMENTATION = getAddress('0x9999999999999999999999999999999999999998')

const sessionAddress = getAddress('0x1111111111111111111111111111111111111111')
const sessionSigner = getAddress('0x2222222222222222222222222222222222222222')
const sender = getAddress('0x3333333333333333333333333333333333333333')

function encodeWord(value: bigint): string {
  return value.toString(16).padStart(64, '0')
}

function toNonCanonicalExecuteWithDeadline(data: `0x${string}`): `0x${string}` {
  const selector = data.slice(0, 10)
  const body = data.slice(10)
  const head0 = body.slice(0, 64)
  const head1 = body.slice(64, 128)
  const head2 = body.slice(128, 192)
  const tail = body.slice(192)

  const offset0 = BigInt(`0x${head0}`)
  const offset1 = BigInt(`0x${head1}`)
  const gapWord = '0'.repeat(64)

  const shifted0 = encodeWord(offset0 + 32n)
  const shifted1 = encodeWord(offset1 + 32n)
  return `0x${selector.slice(2)}${shifted0}${shifted1}${head2}${gapWord}${tail}` as `0x${string}`
}

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
  readJsonBody: (...args: unknown[]) => readJsonBodyMock(...args),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: vi.fn(() => Promise.resolve({ creator: sessionSigner, payoutRecipient: sessionSigner })),
}))

vi.mock('../../server/_lib/logger.js', () => ({
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

// Must be before dynamic import of viem in getBaseClient
const originalFetch = globalThis.fetch

describe('paymaster deploy-session setup (selfcall-only)', () => {
  let restoreEnv: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
      PROTOCOL_TREASURY: sessionSigner,
    })

    readRequestPrincipalMock.mockReturnValue(sessionAddress)
    getActiveDeploySessionMock.mockResolvedValue({ sessionSigner })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753',
      vaultActivationBatcher: '0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      universalCreate2DeployerFromStore: '0x0243F14771054c890E5Ef5D467D0137a20B2d94B',
      universalBytecodeStore: '0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c',
      protocolTreasury: sessionSigner,
    })
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockImplementation(async ({ address }: { address: string }) => {
      if (String(address).toLowerCase() === sessionSigner.toLowerCase()) return '0x'
      return '0x1234'
    })
    mockReadContract.mockImplementation((opts: { address?: string; functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'store') return Promise.resolve('0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c')
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
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
      args: [sessionSigner],
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
    expect(readJsonBodyMock).toHaveBeenCalledWith(req, { maxBytes: 512_000 })
  })

  it('accepts sender-authenticated CSW session even when isOwnerAddress(session) is false', async () => {
    readRequestPrincipalMock.mockReturnValue(sender)
    mockReadContract.mockImplementation((opts: { functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(false)
      if (opts.functionName === 'store') return Promise.resolve('0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c')
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
      return Promise.resolve(null)
    })

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
      args: [sessionSigner],
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
    expect(errMsg).not.toMatch(/not_owner/i)
  })

  it('rejects addOwnerAddress self-call when deploy session owner has contract bytecode', async () => {
    mockGetBytecode.mockImplementation(async ({ address }: { address: string }) => {
      if (String(address).toLowerCase() === sessionSigner.toLowerCase()) return '0x1234'
      return '0x1234'
    })

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
      args: [sessionSigner],
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
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/contract_owner_not_allowed/i)
  })

  it('rejects sponsored calls when sender provenance is not a Coinbase smart wallet implementation', async () => {
    const disallowedImplementation = getAddress('0x9999999999999999999999999999999999999997')
    mockReadContract.mockImplementation((opts: { address?: string; functionName?: string }) => {
      const target = opts.address ? getAddress(opts.address) : null
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'store') return Promise.resolve('0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c')
      if (opts.functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (opts.functionName === 'implementation') {
        if (target && target.toLowerCase() === sender.toLowerCase()) return Promise.resolve(disallowedImplementation)
        return Promise.resolve(CSW_IMPLEMENTATION)
      }
      return Promise.resolve(null)
    })

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
      args: [sessionSigner],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/request denied/i)
    expect(errMsg).toMatch(/sender_implementation_not_allowed/i)
  })

  it('returns JSON-RPC denial when principal resolution throws unexpectedly', async () => {
    readRequestPrincipalMock.mockImplementation(() => {
      throw new Error('principal_resolution_failed')
    })

    const userOp = {
      sender,
      callData: '0x1234',
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    expect(String(responseBody?.error?.message ?? '')).toMatch(/request denied/i)
  })

  it('returns invalid JSON body error when body parsing throws', async () => {
    readJsonBodyMock.mockRejectedValueOnce(new Error('body_parse_failed'))

    const req = createMockReq({
      method: 'POST',
      body: undefined,
      headers: { 'content-type': 'application/json' },
    })
    const res = createMockRes()

    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    expect(String(responseBody?.error?.message ?? '')).toMatch(/invalid json body/i)
  })

  it('returns entrypoint probe fallback result when upstream responds non-JSON', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('<html>upstream unavailable</html>'),
    }) as typeof fetch

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_supportedEntryPoints',
      params: [],
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
    expect(responseBody?.id).toBe(1)
    expect(Array.isArray(responseBody?.result)).toBe(true)
    expect(responseBody?.result?.[0]).toBe(ENTRYPOINT_V06)
  })

  it('returns entrypoint probe fallback result when upstream request throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('upstream_network_error')) as typeof fetch

    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_supportedEntryPoints',
      params: [],
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
    expect(responseBody?.id).toBe(1)
    expect(Array.isArray(responseBody?.result)).toBe(true)
    expect(responseBody?.result?.[0]).toBe(ENTRYPOINT_V06)
  })

  it('returns JSON-RPC error with HTTP 200 for non-probe upstream failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('upstream_network_error')) as typeof fetch

    const body = {
      jsonrpc: '2.0',
      id: 99,
      method: 'eth_getUserOperationReceipt',
      params: ['0x' + 'a'.repeat(64)],
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
    expect(String(responseBody?.error?.message ?? '')).toMatch(/upstream_network_error/i)
  })

  it('rejects swap router execute call with native value', async () => {
    const COINBASE_SMART_WALLET_ABI = [
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

    const UNIVERSAL_ROUTER_ABI = [
      {
        type: 'function',
        name: 'execute',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const

    const baseSwapRouter = '0x6ff5693b99212da76ad316178a184ab56d299b43'
    const swapData = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: ['0x00', ['0x'], 1_900_000_000n],
    })
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [[{ target: baseSwapRouter, value: 1n, data: swapData }]],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/swap_router_value_not_allowed/i)
  })

  it('allows approve plus swap router execute batch', async () => {
    const COINBASE_SMART_WALLET_ABI = [
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

    const ERC20_ABI = [
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const

    const UNIVERSAL_ROUTER_ABI = [
      {
        type: 'function',
        name: 'execute',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const

    const baseSwapRouter = '0x6ff5693b99212da76ad316178a184ab56d299b43'
    const permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
    const token = '0x5555555555555555555555555555555555555555'
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [permit2, 1_000_000n],
    })
    const tokenRefBytes = `0x${'00'.repeat(12)}${token.slice(2)}` as `0x${string}`
    const swapData = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: ['0x00', [tokenRefBytes], 1_900_000_000n],
    })
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [[
        { target: token, value: 0n, data: approveData },
        { target: baseSwapRouter, value: 0n, data: swapData },
      ]],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).not.toMatch(/request denied/i)
    expect(errMsg).not.toMatch(/missing_primary_call/i)
  })

  it('rejects approve-only batches without a primary deploy/swap call', async () => {
    const COINBASE_SMART_WALLET_ABI = [
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

    const ERC20_ABI = [
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const

    const permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
    const token = '0x5555555555555555555555555555555555555555'
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [permit2, 1_000_000n],
    })
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [[{ target: token, value: 0n, data: approveData }]],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/approve_only_not_allowed/i)
  })

  it('rejects swap batch when approvals target multiple tokens', async () => {
    const COINBASE_SMART_WALLET_ABI = [
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

    const ERC20_ABI = [
      {
        type: 'function',
        name: 'approve',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
      },
    ] as const

    const UNIVERSAL_ROUTER_ABI = [
      {
        type: 'function',
        name: 'execute',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const

    const baseSwapRouter = '0x6ff5693b99212da76ad316178a184ab56d299b43'
    const permit2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
    const tokenA = '0x5555555555555555555555555555555555555555'
    const tokenB = '0x6666666666666666666666666666666666666666'
    const approveA = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [permit2, 1_000_000n],
    })
    const approveB = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [permit2, 2_000_000n],
    })
    const swapData = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: ['0x00', ['0x'], 1_900_000_000n],
    })
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [[
        { target: tokenA, value: 0n, data: approveA },
        { target: tokenB, value: 0n, data: approveB },
        { target: baseSwapRouter, value: 0n, data: swapData },
      ]],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/swap_approval_call_count_not_allowed|swap_approval_token_mismatch/i)
  })

  it('rejects non-canonical universal router execute calldata', async () => {
    const COINBASE_SMART_WALLET_ABI = [
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

    const UNIVERSAL_ROUTER_ABI = [
      {
        type: 'function',
        name: 'execute',
        stateMutability: 'payable',
        inputs: [
          { name: 'commands', type: 'bytes' },
          { name: 'inputs', type: 'bytes[]' },
          { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const

    const baseSwapRouter = '0x6ff5693b99212da76ad316178a184ab56d299b43'
    const canonicalSwapData = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: ['0x00', ['0x'], 1_900_000_000n],
    })

    const tamperedSwapData = toNonCanonicalExecuteWithDeadline(canonicalSwapData)
    const decodedCanonical = decodeFunctionData({ abi: UNIVERSAL_ROUTER_ABI, data: canonicalSwapData })
    const decodedTampered = decodeFunctionData({ abi: UNIVERSAL_ROUTER_ABI, data: tamperedSwapData })
    expect(decodedTampered.args).toEqual(decodedCanonical.args)

    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [[{ target: baseSwapRouter, value: 0n, data: tamperedSwapData }]],
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

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/swap_router_non_canonical_encoding/i)
  })
})

describe('paymaster payout-router external approvals', () => {
  let restoreEnv: () => void

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
  const currentUniversalRouter = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43')
  const unknownSpender = getAddress('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')

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

  const COINBASE_SMART_WALLET_ABI = [
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

  const PAYOUT_ROUTER_ADMIN_ABI = [
    {
      type: 'function',
      name: 'setExternalSwapTargetApproval',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'target', type: 'address' },
        { name: 'approved', type: 'bool' },
      ],
      outputs: [],
    },
    {
      type: 'function',
      name: 'setExternalSwapSpenderApproval',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'approved', type: 'bool' },
      ],
      outputs: [],
    },
  ] as const

  function buildFinalizePhase2Call(): { target: `0x${string}`; value: bigint; data: `0x${string}` } {
    const finalizeData = encodeFunctionData({
      abi: BATCHER_FINALIZE_PHASE2_ABI,
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
          meteoraAlphaVault: (`0x${'0'.repeat(64)}`) as `0x${string}`,
          solanaIxs: [],
        },
      ],
    })
    return { target: creatorVaultBatcher, value: 0n, data: finalizeData }
  }

  function buildRouterAdminCall(params: {
    payoutRouterTarget: `0x${string}`
    functionName: 'setExternalSwapTargetApproval' | 'setExternalSwapSpenderApproval'
    subject: `0x${string}`
  }): { target: `0x${string}`; value: bigint; data: `0x${string}` } {
    const adminData = encodeFunctionData({
      abi: PAYOUT_ROUTER_ADMIN_ABI,
      functionName: params.functionName,
      args: [params.subject, true],
    })
    return { target: params.payoutRouterTarget, value: 0n, data: adminData }
  }

  function buildRequest(calls: Array<{ target: `0x${string}`; value: bigint; data: `0x${string}` }>, debug = false) {
    const callData = encodeFunctionData({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'executeBatch',
      args: [calls],
    })
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'pm_getPaymasterStubData',
      params: [{ sender, callData, initCode: '0x' }, ENTRYPOINT_V06, 8453],
    }
    return createMockReq({
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/json',
        ...(debug ? { 'x-cv-paymaster-debug': '1' } : {}),
      },
    })
  }

  function extractExpectedPayoutRouter(message: string): `0x${string}` {
    const match = /expectedPayoutRouter=(0x[a-fA-F0-9]{40})/.exec(message)
    if (!match) throw new Error(`Missing expectedPayoutRouter in debug payload: ${message}`)
    return getAddress(match[1] as `0x${string}`)
  }

  async function discoverExpectedPayoutRouterAddress(): Promise<`0x${string}`> {
    const provisionalRouterCall = buildRouterAdminCall({
      payoutRouterTarget: creatorToken,
      functionName: 'setExternalSwapTargetApproval',
      subject: currentUniversalRouter,
    })
    const req = buildRequest([buildFinalizePhase2Call(), provisionalRouterCall], true)
    const res = createMockRes()
    await paymasterHandler(req as any, res as any)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/expectedPayoutRouter=/i)
    return extractExpectedPayoutRouter(errMsg)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    restoreEnv = applyEnv({
      CDP_PAYMASTER_URL: 'https://paymaster.example.com',
      AUTH_SESSION_SECRET: 'test-secret-at-least-16-chars',
      PROTOCOL_TREASURY: sender,
    })

    readRequestPrincipalMock.mockReturnValue(sessionAddress)
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher,
      vaultActivationBatcher,
      permit2,
      universalCreate2DeployerFromStore: create2Deployer,
      universalBytecodeStore: bytecodeStore,
      protocolTreasury: sender,
      zora: '0x1111111111166b7fe7bd91427724b487980afc69',
      weth: '0x4200000000000000000000000000000000000006',
    })
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockResolvedValue('0x1234')
    mockGetLogs.mockResolvedValue([{ args: { vault, wrapper, shareOFT } }])
    mockReadContract.mockImplementation((opts: { address?: string; functionName?: string }) => {
      const functionName = opts.functionName
      const address = opts.address ? getAddress(opts.address as `0x${string}`) : null
      if (functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (functionName === 'store') return Promise.resolve(bytecodeStore)
      if (functionName === 'entryPoint') return Promise.resolve(ENTRYPOINT_V06)
      if (functionName === 'implementation') return Promise.resolve(CSW_IMPLEMENTATION)
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} })),
    }) as typeof fetch
  })

  afterEach(() => {
    restoreEnv()
    globalThis.fetch = originalFetch
  })

  it('allows setExternalSwapTargetApproval for configured target on expected payout router', async () => {
    const expectedPayoutRouter = await discoverExpectedPayoutRouterAddress()
    const routerCall = buildRouterAdminCall({
      payoutRouterTarget: expectedPayoutRouter,
      functionName: 'setExternalSwapTargetApproval',
      subject: currentUniversalRouter,
    })
    const req = buildRequest([buildFinalizePhase2Call(), routerCall])
    const res = createMockRes()
    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).not.toMatch(/request denied/i)
    expect(errMsg).not.toMatch(/payout_router_external_target_not_allowed/i)
  })

  it('rejects setExternalSwapSpenderApproval for unconfigured spender on expected payout router', async () => {
    const expectedPayoutRouter = await discoverExpectedPayoutRouterAddress()
    const routerCall = buildRouterAdminCall({
      payoutRouterTarget: expectedPayoutRouter,
      functionName: 'setExternalSwapSpenderApproval',
      subject: unknownSpender,
    })
    const req = buildRequest([buildFinalizePhase2Call(), routerCall])
    const res = createMockRes()
    await paymasterHandler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    const responseBody = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
    const errMsg = String(responseBody?.error?.message ?? '')
    expect(errMsg).toMatch(/payout_router_external_spender_not_allowed/i)
  })
})
