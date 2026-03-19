import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData, getAddress } from 'viem'

import paymasterHandler from '../_handlers/_paymaster.ts'
import { createMockReq, createMockRes } from './helpers'
import { applyEnv } from './helpers'

const ENTRYPOINT_V06 = getAddress('0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789')

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
  readJsonBody: (req: { body?: unknown }) => readJsonBodyMock(req),
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
    getActiveDeploySessionMock.mockResolvedValue({ sessionSigner })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0xb2481e6F970B92Cd6435Ed9e19956e2F2D3C1753',
      vaultActivationBatcher: '0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      universalCreate2DeployerFromStore: '0x0243F14771054c890E5Ef5D467D0137a20B2d94B',
      universalBytecodeStore: '0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c',
    })
    isDbConfiguredMock.mockReturnValue(false)
    isSupabaseAdminConfiguredMock.mockReturnValue(false)
    readJsonBodyMock.mockImplementation((req: { body?: unknown }) => Promise.resolve(req.body ?? null))

    mockGetBytecode.mockImplementation(async ({ address }: { address: string }) => {
      if (String(address).toLowerCase() === sessionSigner.toLowerCase()) return '0x'
      return '0x1234'
    })
    mockReadContract.mockImplementation((opts: { functionName?: string }) => {
      if (opts.functionName === 'isOwnerAddress') return Promise.resolve(true)
      if (opts.functionName === 'store') return Promise.resolve('0x2C5Ff5bd3D6f4aF4742e37Df12E51b39F2C63e6c')
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

    const baseSwapRouter = '0x2626664c2603336E57B271c5C0b26F421741e481'
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

    const baseSwapRouter = '0x2626664c2603336E57B271c5C0b26F421741e481'
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

    const baseSwapRouter = '0x2626664c2603336E57B271c5C0b26F421741e481'
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

    const baseSwapRouter = '0x2626664c2603336E57B271c5C0b26F421741e481'
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
