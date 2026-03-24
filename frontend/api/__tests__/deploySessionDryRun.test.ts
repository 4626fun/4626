import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readDeployAuthFromRequestMock,
  isDbConfiguredMock,
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
  getDbMock: vi.fn(),
  getBytecodeMock: vi.fn(async () => '0x'),
  readContractMock: vi.fn(async () => ({ amount: 1n })),
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

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/deployAuth.js', () => ({
  readDeployAuthFromRequest: readDeployAuthFromRequestMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  isDbConfigured: isDbConfiguredMock,
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/rateLimit.js', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, resetAt: Date.now() + 60_000 })),
  RATE_LIMITS: { deployCreate: { limit: 3, windowMs: 60_000 } },
  rateLimitKey: vi.fn(() => 'rl_key'),
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://v1.4626.fun'),
}))

vi.mock('../../server/_lib/deploySessions.js', () => ({
  ensureDeploySessionsSchema: vi.fn(async () => {}),
  hashDeployToken: vi.fn(() => 'hashed'),
  insertDeploySession: insertDeploySessionMock,
  randomDeployToken: vi.fn(() => 'deploy_token'),
  randomId: vi.fn(() => 'sess_123'),
  updateDeploySession: updateDeploySessionMock,
}))

vi.mock('../../server/_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: vi.fn(async () => ({
    walletId: 'agent_1',
    address: '0x00000000000000000000000000000000000000f1',
  })),
}))

vi.mock('../../server/_lib/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: vi.fn(async () => ({ creator: null, payoutRecipient: null })),
  resolveCoinPartiesAndOwner: resolveCoinPartiesAndOwnerMock,
}))

vi.mock('../../server/_lib/charmVaults.js', () => ({
  extractCharmCreateVaultPool: vi.fn(() => null),
  isCharmPoolIndexed: vi.fn(async () => true),
  charmPoolNotIndexedError: (pool: string) =>
    `Charm pool ${pool} is not currently indexed by Charm's public vault data source.`,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: vi.fn(async () => {}),
}))

vi.mock('../../server/_lib/erc7712Permissions.js', () => ({
  buildDeployPermissionGrant: vi.fn(() => ({ version: 'erc7712-v1' })),
}))

vi.mock('../../server/_lib/solanaOvaultCompatibility.js', () => ({
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

function makeCanonicalDb() {
  return {
    query: vi.fn(async () => ({ rows: [{}] })),
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
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
      return { rows: [] }
    }),
  }
}

function makeRequestBody() {
  return {
    smartWallet: '0x0000000000000000000000000000000000000002',
    creatorToken: '0x0000000000000000000000000000000000000003',
    ownerAddress: '0x0000000000000000000000000000000000000002',
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
    createWalletClientMock.mockImplementation(() => ({
      request: requestMock,
      sendTransaction: sendTransactionMock,
    }))
    getDbMock.mockResolvedValue(makeCanonicalDb())
    readDeployAuthFromRequestMock.mockReturnValue({
      address: '0x0000000000000000000000000000000000000001',
      type: 'session',
    })
  })

  it('requires authenticated deploy auth even when legacy dev-bypass header is present', async () => {
    const previousBypass = process.env.DEPLOY_DRY_RUN_DEV_BYPASS
    process.env.DEPLOY_DRY_RUN_DEV_BYPASS = '1'
    readDeployAuthFromRequestMock.mockReturnValueOnce(null as any)
    const { default: handler } = await import('../_handlers/deploy/session/_dryRun.ts')
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

  it('returns a phase summary without persisting session state or sending user operations', async () => {
    const { default: handler } = await import('../_handlers/deploy/session/_dryRun.ts')
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
    const { default: handler } = await import('../_handlers/deploy/session/_dryRun.ts')
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
    const { default: handler } = await import('../_handlers/deploy/session/_dryRun.ts')
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
    const { default: handler } = await import('../_handlers/deploy/session/_dryRun.ts')
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
})
