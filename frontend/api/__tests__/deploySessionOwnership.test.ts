import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/deploy/session/_create.ts'
import { createMockReq, createMockRes } from './helpers'

const {
  readJsonBodyMock,
  readSessionFromRequestMock,
  isDbConfiguredMock,
  getDbMock,
  ensureDeploySessionsSchemaMock,
  insertDeploySessionMock,
  getOrCreateCreatorAgentWalletMock,
  generatePrivateKeyMock,
  privateKeyToAccountMock,
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
  generatePrivateKeyMock: vi.fn(() => ('0x' + '11'.repeat(32)) as `0x${string}`),
  privateKeyToAccountMock: vi.fn(() => ({
    address: '0x00000000000000000000000000000000000000aa',
    privateKey: ('0x' + '11'.repeat(32)) as `0x${string}`,
  })),
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

vi.mock('viem/accounts', () => ({
  generatePrivateKey: generatePrivateKeyMock,
  privateKeyToAccount: privateKeyToAccountMock,
}))

function makeRequestBody() {
  return {
    smartWallet: '0x0000000000000000000000000000000000000002',
    creatorToken: '0x0000000000000000000000000000000000000003',
    ownerAddress: '0x0000000000000000000000000000000000000001',
    phase2Calls: [{ to: '0x0000000000000000000000000000000000000010', value: '0', data: '0x' }],
    phase3Calls: [],
  }
}

function makeCanonicalDb() {
  return {
    query: vi.fn(async () => ({ rows: [{}] })), // allowlist pass
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('is_canonical_smart_wallet = true')) return { rows: [{ profile_id: 99 }] }
      if (text.includes('select lower(address) as address') && text.includes('from profile_wallets')) {
        return {
          rows: [
            { address: '0x0000000000000000000000000000000000000001' },
            { address: '0x0000000000000000000000000000000000000002' },
          ],
        }
      }
      if (text.includes('from profiles') && text.includes('where id =')) {
        return {
          rows: [
            {
              primary_wallet: '0x0000000000000000000000000000000000000001',
              embedded_wallet: null,
              primary_embedded_eoa: null,
              primary_smart_wallet: '0x0000000000000000000000000000000000000002',
              csw_address: '0x0000000000000000000000000000000000000002',
              base_sub_account: null,
            },
          ],
        }
      }
      return { rows: [] }
    }),
  }
}

describe('deploy session ownership guardrails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 403 when canonical smart wallet mapping is missing', async () => {
    getDbMock.mockResolvedValue({
      query: vi.fn(async () => ({ rows: [{}] })),
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
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

  it('creates session when canonical + embedded mappings are consistent', async () => {
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = insertDeploySessionMock.mock.calls[0]?.[0] as any
    expect(insertArgs.payload?.erc7712Grant?.version).toBe('erc7712-v1')
    expect((insertArgs.payload?.erc7712Grant?.allowedTargets ?? []).map((v: string) => v.toLowerCase())).toContain('0x0000000000000000000000000000000000000002')
  })


  it('falls back to local session owner key when agent wallet id is missing', async () => {
    getOrCreateCreatorAgentWalletMock.mockResolvedValueOnce({
      walletId: '',
      address: '0x00000000000000000000000000000000000000f1',
    })
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(generatePrivateKeyMock).toHaveBeenCalledTimes(1)
    expect(privateKeyToAccountMock).toHaveBeenCalledTimes(1)
    const insertArgs = insertDeploySessionMock.mock.calls[0]?.[0] as any
    expect(insertArgs.sessionOwnerPrivateKey).toBe('0x' + '11'.repeat(32))
    expect(insertArgs.payload?.agentWalletId).toBeUndefined()
  })
  it('falls back to local session owner key when agent wallet provisioning fails', async () => {
    getOrCreateCreatorAgentWalletMock.mockRejectedValueOnce(new Error('PRIVY_APP_ID missing'))
    getDbMock.mockResolvedValue(makeCanonicalDb())

    const req = createMockReq({ method: 'POST', body: makeRequestBody() })
    const res = createMockRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(generatePrivateKeyMock).toHaveBeenCalledTimes(1)
    expect(privateKeyToAccountMock).toHaveBeenCalledTimes(1)
    expect(insertDeploySessionMock).toHaveBeenCalledTimes(1)
    const insertArgs = insertDeploySessionMock.mock.calls[0]?.[0] as any
    expect(insertArgs.sessionOwnerPrivateKey).toBe('0x' + '11'.repeat(32))
    expect(insertArgs.payload?.agentWalletId).toBeUndefined()
  })
})
