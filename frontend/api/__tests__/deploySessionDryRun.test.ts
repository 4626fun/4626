import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, type Address } from 'viem'

import { canonicalWalletSchemaReadyResult, createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readDeployAuthFromRequestMock,
  isDbConfiguredMock,
  checkRateLimitMock,
  rateLimitKeyMock,
  getDbMock,
  getBytecodeMock,
  readContractMock,
  callMock,
  requestMock,
  sendTransactionMock,
  waitForTransactionReceiptMock,
  insertDeploySessionMock,
  updateDeploySessionMock,
  sendUserOperationMock,
  createWalletClientMock,
  baseChainMock,
  resolveCoinPartiesAndOwnerMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readDeployAuthFromRequestMock: vi.fn(() => ({
    address: '0x0000000000000000000000000000000000000001',
    type: 'session' as const,
  })),
  isDbConfiguredMock: vi.fn(() => true),
  checkRateLimitMock: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  rateLimitKeyMock: vi.fn((...parts: string[]) => parts.join(':')),
  getDbMock: vi.fn(),
  getBytecodeMock: vi.fn(async (_args: { address: `0x${string}` }) => '0x'),
  readContractMock: vi.fn(async (args: any) => {
    const fn = String(args?.functionName ?? '')
    if (fn === 'owner') return '0x0000000000000000000000000000000000000f01'
    if (fn === 'authorizedDeployers') return true
    if (fn === 'pointers') return '0x0000000000000000000000000000000000000000'
    if (fn === 'chunkCount') return 0n
    if (fn === 'phase1SplitStates') {
      return {
        oftBootstrapRegistry: '0x0000000000000000000000000000000000000000',
        vault: '0x0000000000000000000000000000000000000000',
        wrapper: '0x0000000000000000000000000000000000000000',
        shareOFT: '0x0000000000000000000000000000000000000000',
        shareOftSalt: `0x${'0'.repeat(64)}`,
        paramsHash: `0x${'0'.repeat(64)}`,
        codeIdsHash: `0x${'0'.repeat(64)}`,
        coreDone: false,
        finalized: false,
      }
    }
    if (fn === 'pendingAuctions') {
      return {
        shareOFT: '0x0000000000000000000000000000000000000000',
        ccaStrategy: '0x0000000000000000000000000000000000000000',
        amount: 0n,
        lpReserveAmount: 0n,
      }
    }
    if (fn === 'balanceOf') return 0n
    return '0x0000000000000000000000000000000000000000'
  }),
  callMock: vi.fn(async () => '0x'),
  requestMock: vi.fn(async () => null),
  sendTransactionMock: vi.fn(async () => `0x${'1'.repeat(64)}`),
  waitForTransactionReceiptMock: vi.fn(async () => ({ status: 'success' })),
  insertDeploySessionMock: vi.fn(async () => ({})),
  updateDeploySessionMock: vi.fn(async () => ({})),
  sendUserOperationMock: vi.fn(async () => '0xuserop'),
  createWalletClientMock: vi.fn(),
  baseChainMock: { id: 8453, name: 'Base' },
  resolveCoinPartiesAndOwnerMock: vi.fn(async () => ({
    creator: '0x0000000000000000000000000000000000000002',
    payoutRecipient: null,
    owner: '0x0000000000000000000000000000000000000002',
  })),
}))

vi.mock('@4626/server-core', () => ({
  handleOptions: vi.fn(() => false),
  readBoundedJsonObjectBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  isDbConfigured: isDbConfiguredMock,
  getDb: getDbMock,
  checkRateLimit: checkRateLimitMock,
  checkDurableRateLimit: checkRateLimitMock,
  RATE_LIMITS: {
    deployCreate: { limit: 3, windowMs: 60_000 },
    deploySessionDryRun: { windowMs: 60_000, maxRequests: 10 },
  },
  rateLimitKey: rateLimitKeyMock,
}))

vi.mock('../../server/_lib/auth/deployAuth.js', () => ({
  readDeployAuthFromRequest: readDeployAuthFromRequestMock,
}))

vi.mock('../../server/_lib/infra/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://app.4626.fun'),
}))

vi.mock('../../server/_lib/deploy/deploySessions.js', () => ({
  ensureDeploySessionsSchema: vi.fn(async () => {}),
  hashDeployToken: vi.fn(() => 'hashed'),
  insertDeploySession: insertDeploySessionMock,
  randomDeployToken: vi.fn(() => 'deploy_token'),
  randomId: vi.fn(() => 'sess_123'),
  updateDeploySession: updateDeploySessionMock,
}))

vi.mock('../../server/_lib/wallet/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: vi.fn(async () => ({
    walletId: 'agent_1',
    address: '0x00000000000000000000000000000000000000f1',
  })),
}))

vi.mock('../../server/_lib/db/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/_lib/onchain/coinParties.js', () => ({
  resolveCoinParties: vi.fn(async () => ({ creator: null, payoutRecipient: null })),
  resolveCoinPartiesAndOwner: resolveCoinPartiesAndOwnerMock,
}))

vi.mock('../../server/_lib/deploy/charmVaults.js', () => ({
  extractCharmCreateVaultPool: vi.fn(() => null),
  isCharmPoolIndexed: vi.fn(async () => true),
  charmPoolNotIndexedError: (pool: string) =>
    `Charm pool ${pool} is not currently indexed by Charm's public vault data source.`,
}))

vi.mock('../../server/_lib/onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/wallet/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/deploy/erc7712Permissions.js', () => ({
  buildDeployPermissionGrant: vi.fn(() => ({ version: 'erc7712-v1' })),
}))

vi.mock('../../server/_lib/deploy/ensurePhase3DryRunForkPrep.js', () => ({
  ensurePhase3DryRunForkPrep: vi.fn(async () => ({
    helperEnsured: false,
    create2Ensured: false,
    auxiliaryEnsured: false,
    auxiliaryCreate2Ensured: false,
    batcher: '0x0000000000000000000000000000000000000011',
    phase3Helper: '0x0000000000000000000000000000000000000012',
    create2Deployer: '0x0000000000000000000000000000000000000013',
    previousAuxiliaryBatcher: '0x0000000000000000000000000000000000000014',
    auxiliaryBatcher: '0x0000000000000000000000000000000000000014',
  })),
}))

vi.mock('../../server/_lib/deploy/ensurePhase3HelperCreate2Authorization.js', () => ({
  assertPhase3HelperCreate2Authorization: vi.fn(async () => {}),
}))

vi.mock('../../src/lib/deploy/phase1ModuleDeploy.js', () => ({
  resolveAlignedPhase1DeployDeps: vi.fn(async () => ({
    ok: true,
    create2Deployer: '0x0000000000000000000000000000000000000c21',
    bytecodeStore: '0x0000000000000000000000000000000000000b17',
  })),
  resolveBytecodeStoreForBatcher: vi.fn(async () => '0x0000000000000000000000000000000000000b17'),
  resolveCreate2DeployerForBatcher: vi.fn(async () => '0x0000000000000000000000000000000000000c21'),
  resolveWiredCreatorOvaultModules: vi.fn(async () => null),
}))

vi.mock('../../server/_lib/onchain/solanaOvaultCompatibility.js', () => ({
  normalizeSolanaAssetMintOrigin: vi.fn((_value: unknown, fallback: string) => fallback),
  parseSolanaOvaultMintCompatibilityHints: vi.fn(() => ({
    existingMintCompatible: null,
    depositEligible: null,
    redeemEligible: null,
    transferHookDetected: null,
    oftFeeIsZero: null,
  })),
}))

vi.mock('../../src/wallet/canonicalWalletPolicy', () => ({
  hasContractBytecode: vi.fn((bytecode: unknown) => typeof bytecode === 'string' && bytecode !== '0x'),
}))

vi.mock('viem/account-abstraction', () => ({
  sendUserOperation: sendUserOperationMock,
}))

vi.mock('viem/chains', () => ({
  base: baseChainMock,
}))

vi.mock('viem/accounts', () => ({
  generatePrivateKey: vi.fn(() => ('0x' + '11'.repeat(32)) as `0x${string}`),
  privateKeyToAccount: vi.fn(() => ({
    address: '0x00000000000000000000000000000000000000aa',
    privateKey: ('0x' + '11'.repeat(32)) as `0x${string}`,
  })),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBytecode: getBytecodeMock,
      readContract: readContractMock,
      call: callMock,
      waitForTransactionReceipt: waitForTransactionReceiptMock,
    })),
    createWalletClient: createWalletClientMock,
    http: vi.fn(() => ({})),
  }
})

const TEST_OWNER = '0x0000000000000000000000000000000000000002' as Address
const TEST_CREATOR = '0x0000000000000000000000000000000000000003' as Address
const TEST_VAULT = '0x0000000000000000000000000000000000000101' as Address
const TEST_WRAPPER = '0x0000000000000000000000000000000000000102' as Address
const TEST_SHARE = '0x0000000000000000000000000000000000000103' as Address
const TEST_GAUGE = '0x0000000000000000000000000000000000000201' as Address
const TEST_CCA = '0x0000000000000000000000000000000000000202' as Address
const TEST_ORACLE = '0x0000000000000000000000000000000000000203' as Address
const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const
const TEST_CODE_IDS = {
  vault: ZERO_BYTES32,
  wrapper: ZERO_BYTES32,
  shareOFT: ZERO_BYTES32,
  gauge: ZERO_BYTES32,
  cca: ZERO_BYTES32,
  oracle: ZERO_BYTES32,
  oftBootstrap: ZERO_BYTES32,
} as const

const TEST_PHASE2_CORE_ABI = [
  {
    type: 'function',
    name: 'deployPhase2Core',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'creatorToken', type: 'address' },
          { name: 'owner', type: 'address' },
          { name: 'creatorTreasury', type: 'address' },
          { name: 'payoutRecipient', type: 'address' },
          { name: 'vault', type: 'address' },
          { name: 'wrapper', type: 'address' },
          { name: 'shareOFT', type: 'address' },
          { name: 'shareSymbol', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'floorPriceQ96', type: 'uint256' },
        ],
      },
      {
        name: 'codeIds',
        type: 'tuple',
        components: [
          { name: 'vault', type: 'bytes32' },
          { name: 'wrapper', type: 'bytes32' },
          { name: 'shareOFT', type: 'bytes32' },
          { name: 'gauge', type: 'bytes32' },
          { name: 'cca', type: 'bytes32' },
          { name: 'oracle', type: 'bytes32' },
          { name: 'oftBootstrap', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const

const TEST_FINALIZE_PHASE2_ABI = [
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

function makePhase2CoreData() {
  return encodeFunctionData({
    abi: TEST_PHASE2_CORE_ABI,
    functionName: 'deployPhase2Core',
    args: [
      {
        creatorToken: TEST_CREATOR,
        owner: TEST_OWNER,
        creatorTreasury: '0x0000000000000000000000000000000000000004',
        payoutRecipient: '0x0000000000000000000000000000000000000000',
        vault: TEST_VAULT,
        wrapper: TEST_WRAPPER,
        shareOFT: TEST_SHARE,
        shareSymbol: 'TEST',
        version: 'vtest',
        floorPriceQ96: 1n,
      },
      TEST_CODE_IDS,
    ],
  })
}

function makeFinalizePhase2Data() {
  return encodeFunctionData({
    abi: TEST_FINALIZE_PHASE2_ABI,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken: TEST_CREATOR,
        owner: TEST_OWNER,
        vault: TEST_VAULT,
        wrapper: TEST_WRAPPER,
        shareOFT: TEST_SHARE,
        gaugeController: TEST_GAUGE,
        ccaStrategy: TEST_CCA,
        oracle: TEST_ORACLE,
        version: 'vtest',
        depositAmount: 1n,
        requiredRaise: 1n,
        floorPriceQ96: 1n,
        auctionSteps: '0x',
        meteoraAlphaVault: ZERO_BYTES32,
        solanaIxs: [],
      },
    ],
  })
}

function makeCanonicalDb() {
  return {
    query: vi.fn(async () => ({ rows: [{}] })),
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      const schemaReady = canonicalWalletSchemaReadyResult(text)
      if (schemaReady) return schemaReady
      if (text.includes('from profiles p') && text.includes('where p.id =')) {
        return {
          rows: [
            {
              id: 99,
              primary_wallet: '0x0000000000000000000000000000000000000001',
              embedded_wallet: null,
              primary_embedded_eoa: null,
              primary_smart_wallet: '0x0000000000000000000000000000000000000002',
              csw_address: '0x0000000000000000000000000000000000000002',
              base_sub_account: null,
              canonical_wallet: '0x0000000000000000000000000000000000000002',
            },
          ],
        }
      }
      if (text.includes('from profile_wallets') && text.includes('select profile_id') && text.includes('is_canonical_smart_wallet = true')) {
        return { rows: [{ profile_id: 99 }] }
      }
      if (text.includes('from creator_strategy_features')) {
        if (text.includes('and feature_key =')) {
          // Vanity entitlement checks should remain inactive in baseline tests.
          return { rows: [] }
        }
        return {
          rows: [
            {
              id: 1,
              creator_token: '0x0000000000000000000000000000000000000003',
              feature_key: 'charm_active_lp',
              status: 'active',
              price_usdc_paid: '100000000',
              payment_tx_hash: null,
              payment_from: null,
              payment_to: null,
              payment_verified_at: new Date().toISOString(),
              provisioned_at: null,
              failed_at: null,
              refunded_at: null,
              provisioner_ref: null,
              failure_reason: null,
              metadata: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

function makeRequestBody() {
  return {
    smartWallet: TEST_OWNER,
    creatorToken: TEST_CREATOR,
    ownerAddress: TEST_OWNER,
    phase1Calls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x12345678' }],
    phase2CoreCalls: [{ to: '0x0000000000000000000000000000000000000011', value: '0', data: '0x23456789' }],
    phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000012', value: '0', data: '0x34567890' }],
    phase3Calls: [{ to: '0x0000000000000000000000000000000000000013', value: '0', data: '0x45678901' }],
    phase4Calls: [],
    version: 'vtest',
  }
}

describe('deploy session dry run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BASE_RPC_URL = 'http://127.0.0.1:8545'
    process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET = 'test-deploy-session-hmac-secret'
    createWalletClientMock.mockImplementation(() => ({
      request: requestMock,
      sendTransaction: sendTransactionMock,
    }))
    getDbMock.mockResolvedValue(makeCanonicalDb())
    readDeployAuthFromRequestMock.mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      type: 'session',
    })
    checkRateLimitMock.mockReturnValue({ allowed: true, resetAt: Date.now() + 60_000 })
    requestMock.mockResolvedValue(null)
    getBytecodeMock.mockResolvedValue('0x')
  })

  it('requires authenticated deploy auth even when legacy dev-bypass header is present', async () => {
    const previousBypass = process.env.DEPLOY_DRY_RUN_DEV_BYPASS
    process.env.DEPLOY_DRY_RUN_DEV_BYPASS = '1'
    readDeployAuthFromRequestMock.mockReturnValueOnce(null as any)
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-deploy-dry-run-dev': '0x00000000000000000000000000000000000000ff' },
      body: makeRequestBody(),
    })
    const res = createMockRes()

    try {
      await handler(req, res)
      expect(res.statusCode).toBe(401)
      expect(String(res.body?.error ?? '')).toContain('Not authenticated')
    } finally {
      if (typeof previousBypass === 'undefined') delete process.env.DEPLOY_DRY_RUN_DEV_BYPASS
      else process.env.DEPLOY_DRY_RUN_DEV_BYPASS = previousBypass
    }
  })

  it('returns 429 when dry-run is rate limited', async () => {
    checkRateLimitMock.mockReturnValueOnce({ allowed: false, resetAt: Date.now() + 45_000 })
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(String(res.body?.error ?? '')).toContain('Too many dry-run attempts')
    expect(String(res.getHeader('retry-after') ?? '')).not.toBe('')
  })

  it('requires paid vanity entitlement when dry-run requests custom vanity deploy options', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        vanity: {
          vaultPrefix: '0xface',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(402)
    expect(String(res.body?.error ?? '')).toContain('Vanity deploy requires paid feature activation')
    expect(String(res.body?.error ?? '')).toContain('deploy_vanity_vault_prefix_len_4')
  })

  it('allows dry-run with free default vanity patterns without paid entitlement', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        vanity: {
          vaultPrefix: '0x4626',
          shareSuffix: '4626',
        },
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ok).toBe(true)
  })

  it('returns a phase summary without persisting session state or sending user operations', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ok).toBe(true)
    expect(res.body?.data?.phases?.map((phase: any) => phase.name)).toEqual([
      'phase1',
      'phase2Core',
      'phase2Finalize',
      'phase3',
    ])
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
    expect(updateDeploySessionMock).not.toHaveBeenCalled()
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('configures base chain for fork transaction sends', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()

    await handler(req, res)

    expect(createWalletClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: baseChainMock,
      }),
    )
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        chain: baseChainMock,
      }),
    )
  })

  it('returns a non-500 error when dry-run is called without a local fork RPC', async () => {
    process.env.BASE_RPC_URL = 'https://mainnet.base.org'
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('local-fork-only')
    expect(createWalletClientMock).not.toHaveBeenCalled()
    expect(sendTransactionMock).not.toHaveBeenCalled()
  })

  it('returns the first failing phase and call index when simulation fails', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    sendTransactionMock
      .mockResolvedValueOnce(`0x${'1'.repeat(64)}`)
      .mockRejectedValueOnce(new Error('phase3 exploded'))

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2CoreCalls: [],
        phase2FinalizeCalls: [],
        phase3Calls: [{ to: '0x0000000000000000000000000000000000000013', value: '0', data: '0x45678901' }],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.ok).toBe(false)
    expect(res.body?.data?.failure).toEqual(
      expect.objectContaining({
        phase: 'phase3',
        callIndex: 0,
      }),
    )
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
    expect(sendUserOperationMock).not.toHaveBeenCalled()
  })

  it('formats CREATE2 deploy failures as actionable dry-run errors', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    sendTransactionMock.mockRejectedValueOnce(new Error('execution reverted: custom error 0xb4f54111'))
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2CoreCalls: [],
        phase2FinalizeCalls: [],
        phase3Calls: [],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ok).toBe(false)
    expect(res.body?.data?.failure?.error).toContain('DeployFailed()')
    expect(res.body?.data?.failure?.error).toContain('CREATE2 deployment failed')
  })

  it('formats ERC20 insufficient balance failures as actionable dry-run errors', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const ownerWord = TEST_OWNER.slice(2).padStart(64, '0')
    const balanceWord = (1_000_000n * 10n ** 18n).toString(16).padStart(64, '0')
    const neededWord = (10_000_000n * 10n ** 18n).toString(16).padStart(64, '0')
    sendTransactionMock.mockRejectedValueOnce(
      new Error(`execution reverted: custom error 0xe450d38c: ${ownerWord}${balanceWord}${neededWord}`),
    )
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2CoreCalls: [],
        phase2FinalizeCalls: [],
        phase3Calls: [],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ok).toBe(false)
    expect(res.body?.data?.failure?.error).toContain('ERC20InsufficientBalance()')
    expect(res.body?.data?.failure?.error).toContain('1,000,000 creator tokens')
    expect(res.body?.data?.failure?.error).toContain('10,000,000')
  })

  it('skips phase2 core during dry-run when all projected core contracts already exist', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    const phase2CoreData = makePhase2CoreData()
    getBytecodeMock.mockImplementation(async ({ address }: { address: Address }) =>
      [TEST_GAUGE, TEST_CCA, TEST_ORACLE].some((known) => known.toLowerCase() === address.toLowerCase()) ? '0x6000' : '0x',
    )
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase1Calls: [],
        phase2CoreCalls: [{ to: '0x0000000000000000000000000000000000000011', value: '0', data: phase2CoreData }],
        phase2FinalizeCalls: [
          { to: '0x0000000000000000000000000000000000000012', value: '0', data: makeFinalizePhase2Data() },
        ],
        phase3Calls: [],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ok).toBe(true)
    expect(res.body?.data?.phases).toEqual([
      { name: 'phase2Core', status: 'passed', callCount: 1 },
      { name: 'phase2Finalize', status: 'passed', callCount: 1 },
    ])
    expect(sendTransactionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: phase2CoreData }),
    )
  })

  it('returns an actionable failure when phase2 core is partially deployed on the fork', async () => {
    const { default: handler } = await import('../_handlers/deploy/v2/session/_dryRun.ts')
    getBytecodeMock.mockImplementation(async ({ address }: { address: Address }) =>
      address.toLowerCase() === TEST_GAUGE.toLowerCase() ? '0x6000' : '0x',
    )
    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase1Calls: [],
        phase2CoreCalls: [{ to: '0x0000000000000000000000000000000000000011', value: '0', data: makePhase2CoreData() }],
        phase2FinalizeCalls: [
          { to: '0x0000000000000000000000000000000000000012', value: '0', data: makeFinalizePhase2Data() },
        ],
        phase3Calls: [],
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.data?.ok).toBe(false)
    expect(res.body?.data?.failure).toEqual(
      expect.objectContaining({
        phase: 'phase2Core',
        callIndex: 0,
        error: expect.stringContaining('Phase 2 core is partially deployed on the local fork'),
      }),
    )
    expect(sendTransactionMock).not.toHaveBeenCalled()
  })
})
