import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFunctionData, encodeFunctionData } from 'viem'

import handler from '../_handlers/deploy/session/_create.ts'
import { canonicalWalletSchemaReadyResult, createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readSessionFromRequestMock,
  isDbConfiguredMock,
  getDbMock,
  ensureDeploySessionsSchemaMock,
  insertDeploySessionMock,
  getOrCreateCreatorAgentWalletMock,
  resolveCoinPartiesMock,
  resolveCoinPartiesAndOwnerMock,
  extractCharmCreateVaultPoolMock,
  isCharmPoolIndexedMock,
  createPublicClientMock,
  getBytecodeMock,
  ensureWaitlistSchemaMock,
} = vi.hoisted(() => ({
  readJsonBodyMock: vi.fn(async (req: any) => req.body),
  readSessionFromRequestMock: vi.fn(() => ({ address: '0x0000000000000000000000000000000000000001' })),
  isDbConfiguredMock: vi.fn(() => true),
  getDbMock: vi.fn(),
  ensureDeploySessionsSchemaMock: vi.fn(async () => {}),
  insertDeploySessionMock: vi.fn(async () => ({})),
  getOrCreateCreatorAgentWalletMock: vi.fn(async () => ({
    walletId: 'agent_1',
    address: '0x00000000000000000000000000000000000000f1',
  })),
  resolveCoinPartiesMock: vi.fn(async () => ({ creator: null, payoutRecipient: null })),
  resolveCoinPartiesAndOwnerMock: vi.fn(async () => ({
    creator: '0x0000000000000000000000000000000000000002',
    payoutRecipient: null,
    owner: '0x0000000000000000000000000000000000000002',
  })),
  extractCharmCreateVaultPoolMock: vi.fn((() => null) as (call: unknown) => string | null),
  isCharmPoolIndexedMock: vi.fn(async () => true),
  getBytecodeMock: vi.fn(async () => '0x'),
  createPublicClientMock: vi.fn(() => ({
    getBytecode: getBytecodeMock,
  })),
  ensureWaitlistSchemaMock: vi.fn(async () => {}),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: readJsonBodyMock,
  readSessionFromRequest: readSessionFromRequestMock,
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

vi.mock('../../server/_lib/deploySessions.js', () => ({
  ensureDeploySessionsSchema: ensureDeploySessionsSchemaMock,
  hashDeployToken: vi.fn(() => 'hashed'),
  insertDeploySession: insertDeploySessionMock,
  randomDeployToken: vi.fn(() => 'deploy_token'),
  randomId: vi.fn(() => 'sess_123'),
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

vi.mock('../../server/_lib/supabaseAdmin.js', () => ({
  isSupabaseAdminConfigured: vi.fn(() => false),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('../../server/_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: getOrCreateCreatorAgentWalletMock,
}))

vi.mock('../../server/_lib/origin.js', () => ({
  getCanonicalOrigin: vi.fn(() => 'https://4626-test-akita-llc.vercel.app'),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: resolveCoinPartiesMock,
  resolveCoinPartiesAndOwner: resolveCoinPartiesAndOwnerMock,
}))

vi.mock('../../server/_lib/charmVaults.js', () => ({
  extractCharmCreateVaultPool: extractCharmCreateVaultPoolMock,
  isCharmPoolIndexed: isCharmPoolIndexedMock,
  charmPoolNotIndexedError: (pool: string) =>
    `Charm pool ${pool} is not currently indexed by Charm's public vault data source. Deploying a vault against this pool can succeed on-chain but remain invisible on alpha.charm.fi.`,
}))

vi.mock('../../server/_lib/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('../../server/_lib/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: vi.fn(async () => {}),
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({})),
  }
})

function makeRequestBody() {
  return {
    smartWallet: '0x0000000000000000000000000000000000000002',
    creatorToken: '0x0000000000000000000000000000000000000003',
    // Handler invariant: ownerAddress must match smartWallet (canonical deploy sender)
    ownerAddress: '0x0000000000000000000000000000000000000002',
    phase2FinalizeCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
    phase3Calls: [],
  }
}

function makeFinalizePhase2Data() {
  return encodeFunctionData({
    abi: [
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
              { name: 'shareToken', type: 'address' },
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
    ] as const,
    functionName: 'finalizePhase2',
    args: [
      {
        creatorToken: '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        vault: '0x0000000000000000000000000000000000000101',
        wrapper: '0x0000000000000000000000000000000000000102',
        shareToken: '0x0000000000000000000000000000000000000103',
        gaugeController: '0x0000000000000000000000000000000000000104',
        ccaStrategy: '0x0000000000000000000000000000000000000105',
        oracle: '0x0000000000000000000000000000000000000106',
        version: 'vtest',
        depositAmount: 5_000_000n * 10n ** 18n,
        requiredRaise: 1n,
        floorPriceQ96: 1n,
        auctionSteps: '0x',
        meteoraAlphaVault: `0x${'00'.repeat(32)}`,
        solanaIxs: [],
      },
    ],
  })
}

function makeDeployPhase2CoreData(payoutRecipient: `0x${string}`) {
  return encodeFunctionData({
    abi: [
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
        outputs: [
          {
            name: 'out',
            type: 'tuple',
            components: [
              { name: 'gaugeController', type: 'address' },
              { name: 'ccaStrategy', type: 'address' },
              { name: 'oracle', type: 'address' },
              { name: 'auction', type: 'address' },
            ],
          },
        ],
      },
    ] as const,
    functionName: 'deployPhase2Core',
    args: [
      {
        creatorToken: '0x0000000000000000000000000000000000000003',
        owner: '0x0000000000000000000000000000000000000002',
        creatorTreasury: '0x00000000000000000000000000000000000000aa',
        payoutRecipient,
        vault: '0x0000000000000000000000000000000000000101',
        wrapper: '0x0000000000000000000000000000000000000102',
        shareOFT: '0x0000000000000000000000000000000000000103',
        shareSymbol: 'SHARE',
        version: 'vtest',
        floorPriceQ96: 1n,
      },
      {
        vault: `0x${'11'.repeat(32)}`,
        wrapper: `0x${'22'.repeat(32)}`,
        shareOFT: `0x${'33'.repeat(32)}`,
        gauge: `0x${'44'.repeat(32)}`,
        cca: `0x${'55'.repeat(32)}`,
        oracle: `0x${'66'.repeat(32)}`,
        oftBootstrap: `0x${'77'.repeat(32)}`,
      },
    ],
  })
}

function makeCanonicalDb() {
  return {
    query: vi.fn(async () => ({ rows: [{}] })), // allowlist pass
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

function makeCanonicalDbWithHistoricalSessionOnly() {
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
              primary_wallet: '0x0000000000000000000000000000000000000004',
              primary_embedded_eoa: '0x0000000000000000000000000000000000000004',
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

describe('deploy session ownership guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DEPLOY_SESSION_TTL_MINUTES
    resolveCoinPartiesMock.mockResolvedValue({ creator: null, payoutRecipient: null })
    resolveCoinPartiesAndOwnerMock.mockResolvedValue({
      creator: '0x0000000000000000000000000000000000000002',
      payoutRecipient: null,
      owner: '0x0000000000000000000000000000000000000002',
    })
    extractCharmCreateVaultPoolMock.mockReturnValue(null)
    isCharmPoolIndexedMock.mockResolvedValue(true)
    getBytecodeMock.mockResolvedValue('0x')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 400 for malformed deploy addresses', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        smartWallet: 'not-an-address',
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.error).toBe('Invalid addresses')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('rejects contract owner additions in submitted deploy calls', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())
    const contractOwner = '0x00000000000000000000000000000000000000cc'
    getBytecodeMock.mockImplementation((async (...args: any[]) => {
      const address = String(args?.[0]?.address ?? '')
      if (address.toLowerCase() === contractOwner.toLowerCase()) return '0x1234'
      return '0x'
    }) as any)
    const addOwnerData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'addOwnerAddress',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [],
        },
      ] as const,
      functionName: 'addOwnerAddress',
      args: [contractOwner],
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase1Calls: [
          {
            to: '0x0000000000000000000000000000000000000002',
            value: '0',
            data: addOwnerData,
          },
        ],
        phase2FinalizeCalls: [],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('Only EOA owners can be added')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('rejects deploy sessions when Charm createVault targets a non-indexed pool', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())
    extractCharmCreateVaultPoolMock.mockReturnValueOnce('0x00000000000000000000000000000000000000ab')
    isCharmPoolIndexedMock.mockResolvedValueOnce(false)

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase1Calls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x4989742a' }],
        phase2FinalizeCalls: [],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(String(res.body?.error ?? '')).toContain('not currently indexed')
    expect(isCharmPoolIndexedMock).toHaveBeenCalledWith({
      poolAddress: '0x00000000000000000000000000000000000000ab',
    })
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('returns 403 when canonical smart wallet mapping is missing', async () => {
    getDbMock.mockResolvedValue({
      query: vi.fn(async () => ({ rows: [{}] })),
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
        const schemaReady = canonicalWalletSchemaReadyResult(text)
        if (schemaReady) return schemaReady
        if (text.includes('is_canonical_smart_wallet = true')) return { rows: [] }
        return { rows: [] }
      }),
    })

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error || '')).toContain('ownership')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('rejects stale historical session wallets that are no longer current deploy authority', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDbWithHistoricalSessionOnly())
    readSessionFromRequestMock.mockReturnValue({ address: '0x0000000000000000000000000000000000000001' } as any)

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error || '')).toContain('ownership')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('creates session when canonical + embedded mappings are consistent', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    expect(insertArgs.payload?.erc7712Grant?.version).toBe('erc7712-v1')
    expect((insertArgs.payload?.erc7712Grant?.allowedTargets ?? []).map((v: string) => v.toLowerCase())).toContain('0x0000000000000000000000000000000000000010')
    expect(insertArgs.payload?.persistSessionOwner).toBe(false)
  })

  it('prepends creatorToken approval before phase2 finalize and whitelists selector', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())
    const finalizeData = makeFinalizePhase2Data()

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2FinalizeCalls: [
          {
            to: '0x0000000000000000000000000000000000000010',
            value: '0',
            data: finalizeData,
          },
        ],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    const phase2FinalizeCalls = insertArgs.payload?.phase2FinalizeCalls as Array<{ to: string; data: string }>
    expect(Array.isArray(phase2FinalizeCalls)).toBe(true)
    expect(phase2FinalizeCalls.length).toBe(2)
    expect(phase2FinalizeCalls[0]?.to?.toLowerCase()).toBe('0x0000000000000000000000000000000000000003')
    expect(String(phase2FinalizeCalls[0]?.data || '').toLowerCase().startsWith('0x095ea7b3')).toBe(true)
    expect(String(phase2FinalizeCalls[1]?.data || '').toLowerCase()).toBe(finalizeData.toLowerCase())

    const decodedApprove = decodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'approve',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          outputs: [{ type: 'bool' }],
        },
      ] as const,
      data: phase2FinalizeCalls[0]!.data as `0x${string}`,
    })
    expect(decodedApprove.functionName).toBe('approve')
    expect((decodedApprove.args?.[0] as string).toLowerCase()).toBe('0x0000000000000000000000000000000000000010')
    expect(decodedApprove.args?.[1]).toBe(5_000_000n * 10n ** 18n)

    expect((insertArgs.payload?.erc7712Grant?.allowedSelectors ?? []).map((v: string) => v.toLowerCase())).toContain(
      '0x095ea7b3',
    )
  })

  it('moves auto-injected finalize approvals into phase2 core when core stage exists', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())
    const finalizeData = makeFinalizePhase2Data()

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2CoreCalls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0xf9344d88' }],
        phase2FinalizeCalls: [
          {
            to: '0x0000000000000000000000000000000000000010',
            value: '0',
            data: finalizeData,
          },
        ],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    const phase2CoreCalls = insertArgs.payload?.phase2CoreCalls as Array<{
      to: string
      data: string
      value?: unknown
    }>
    const phase2FinalizeCalls = insertArgs.payload?.phase2FinalizeCalls as Array<{ to: string; data: string }>

    expect(Array.isArray(phase2CoreCalls)).toBe(true)
    expect(Array.isArray(phase2FinalizeCalls)).toBe(true)
    expect(phase2CoreCalls.length).toBe(2)
    expect(phase2CoreCalls[0]?.to?.toLowerCase()).toBe('0x0000000000000000000000000000000000000010')
    expect(String(phase2CoreCalls[0]?.data || '').toLowerCase()).toBe('0xf9344d88')
    expect(phase2CoreCalls[0]?.value).toBe('0')
    expect(phase2CoreCalls[1]?.to?.toLowerCase()).toBe('0x0000000000000000000000000000000000000003')
    expect(String(phase2CoreCalls[1]?.data || '').toLowerCase().startsWith('0x095ea7b3')).toBe(true)
    expect(typeof phase2CoreCalls[1]?.value).not.toBe('bigint')

    // Finalize stage remains single-call (no same-stage approval prepend).
    expect(phase2FinalizeCalls.length).toBe(1)
    expect(String(phase2FinalizeCalls[0]?.data || '').toLowerCase()).toBe(finalizeData.toLowerCase())
    expect(() => JSON.stringify(insertArgs.payload)).not.toThrow()
  })

  it('persists inferred phase2 invariant expectations from phase2 core and finalize calls', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())
    const finalizeData = makeFinalizePhase2Data()
    const payoutRecipient = '0x0000000000000000000000000000000000000200' as const

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        phase2CoreCalls: [
          {
            to: '0x0000000000000000000000000000000000000010',
            value: '0',
            data: makeDeployPhase2CoreData(payoutRecipient),
          },
        ],
        phase2FinalizeCalls: [
          {
            to: '0x0000000000000000000000000000000000000010',
            value: '0',
            data: finalizeData,
          },
        ],
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    expect(String(insertArgs.payload?.expectedTradeFeeCollector ?? '').toLowerCase()).toBe(
      '0x0000000000000000000000000000000000000104',
    )
    expect(insertArgs.payload?.expectedPayoutRecipientMode).toBe('payout_router')
    expect(String(insertArgs.payload?.expectedPayoutRecipient ?? '').toLowerCase()).toBe(
      payoutRecipient.toLowerCase(),
    )
  })

  it('uses a 45-minute default deploy session TTL', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T07:00:00.000Z'))
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    expect(insertArgs.expiresAt).toBeInstanceOf(Date)
    expect(insertArgs.expiresAt.toISOString()).toBe('2026-03-01T07:45:00.000Z')
    expect(insertArgs.payload?.erc7712Grant?.validUntil).toBe('2026-03-01T07:45:00.000Z')
  })

  it('respects DEPLOY_SESSION_TTL_MINUTES override', async () => {
    process.env.DEPLOY_SESSION_TTL_MINUTES = '90'
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-01T07:00:00.000Z'))
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    expect(insertArgs.expiresAt).toBeInstanceOf(Date)
    expect(insertArgs.expiresAt.toISOString()).toBe('2026-03-01T08:30:00.000Z')
    expect(insertArgs.payload?.erc7712Grant?.validUntil).toBe('2026-03-01T08:30:00.000Z')
  })

  it('does not persist client-provided solana OVault compatibility hints', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({
      method: 'POST',
      body: {
        ...makeRequestBody(),
        solanaOvault: {
          enabled: true,
          assetMintOrigin: 'existing',
          assetMeshMint: '11111111111111111111111111111111',
          shareMeshMint: '22222222222222222222222222222222',
          solanaEid: 30168,
          mintCompatibilityHints: {
            tokenProgram: 'token-2022',
            transferHookDetected: true,
            oftFeeBps: 0,
            adapterMode: 'regular-oft',
            authorityCompatible: true,
            rentValueLamports: '2039280',
          },
        },
      },
    })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = (insertDeploySessionMock.mock.calls as any[])[0]?.[0] as any
    expect(insertArgs.payload?.solanaOvault?.enabled).toBe(true)
    expect(insertArgs.payload?.solanaOvault?.assetMintOrigin).toBe('existing')
    expect(insertArgs.payload?.solanaOvault?.solanaEid).toBe(30168)
    expect(insertArgs.payload?.solanaOvault?.mintCompatibilityHints).toBeUndefined()
  })

  it('rejects creator-token party allowlist spoofing when caller is not directly allowlisted', async () => {
    resolveCoinPartiesAndOwnerMock.mockResolvedValueOnce({
      creator: null,
      payoutRecipient: '0x00000000000000000000000000000000000000aa',
      owner: null,
    } as any)
    const db = makeCanonicalDb()
    ;(db.query as any).mockImplementation(async (sql: string, params: any[]) => {
      const text = String(sql).toLowerCase()
      const addressFilters = Array.isArray(params?.[0]) ? (params[0] as string[]) : []
      if (text.includes('from allowlist')) {
        return { rows: addressFilters.includes('0x00000000000000000000000000000000000000aa') ? [{}] : [] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('returns actionable creator access error when allowlist checks fail', async () => {
    const db = makeCanonicalDb()
    ;(db.query as any).mockResolvedValue({ rows: [] })
    getDbMock.mockResolvedValue(db)

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(403)
    expect(String(res.body?.error ?? '')).toContain('Active session wallet')
    expect(String(res.body?.error ?? '')).toContain('Checked addresses:')
  })

  it('returns 503 when agent wallet id is missing', async () => {
    getOrCreateCreatorAgentWalletMock.mockResolvedValueOnce({
      walletId: '',
      address: '0x00000000000000000000000000000000000000f1',
    })
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(String(res.body?.error ?? '')).toContain('Managed deploy signer wallet is unavailable')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })
  it('returns 503 when agent wallet provisioning fails', async () => {
    getOrCreateCreatorAgentWalletMock.mockRejectedValueOnce(new Error('PRIVY_APP_ID missing'))
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(String(res.body?.error ?? '')).toContain('Managed deploy signer wallet is unavailable')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()
  })

  it('returns 503 on Vercel when direct CDP endpoint env is missing', async () => {
    const prevVercel = process.env.VERCEL
    const prevCdp = process.env.CDP_PAYMASTER_URL
    process.env.VERCEL = '1'
    delete process.env.CDP_PAYMASTER_URL

    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(503)
    expect(String(res.body?.error || '')).toContain('CDP_PAYMASTER_URL')
    expect(insertDeploySessionMock).not.toHaveBeenCalled()

    if (prevVercel == null) delete process.env.VERCEL
    else process.env.VERCEL = prevVercel
    if (prevCdp == null) delete process.env.CDP_PAYMASTER_URL
    else process.env.CDP_PAYMASTER_URL = prevCdp
  })

  it('returns 503 on Vercel when deploy session token signing secret is missing', async () => {
    const prevVercel = process.env.VERCEL
    const prevCdp = process.env.CDP_PAYMASTER_URL
    const prevHmacSecret = process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET
    try {
      process.env.VERCEL = '1'
      process.env.CDP_PAYMASTER_URL = 'https://cdp.example.test'
      delete process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: [] }),
        })),
      )

      getDbMock.mockResolvedValue(makeCanonicalDb())

      const req = createMockReq({ method: 'POST', body: makeRequestBody() })
      const res = createMockRes()
      await handler(req, res)

      expect(res.statusCode).toBe(503)
      expect(String(res.body?.error || '')).toContain('DEPLOY_SESSION_TOKEN_HMAC_SECRET')
      expect(insertDeploySessionMock).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      if (prevVercel == null) delete process.env.VERCEL
      else process.env.VERCEL = prevVercel
      if (prevCdp == null) delete process.env.CDP_PAYMASTER_URL
      else process.env.CDP_PAYMASTER_URL = prevCdp
      if (prevHmacSecret == null) delete process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET
      else process.env.DEPLOY_SESSION_TOKEN_HMAC_SECRET = prevHmacSecret
    }
  })

})
