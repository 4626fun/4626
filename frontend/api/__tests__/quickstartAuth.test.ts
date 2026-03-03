import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/creators/_quickstart.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  readSessionFromRequestMock,
  readSiwaAgentFromRequestMock,
  readJsonBodyMock,
  getDbMock,
  isDbConfiguredMock,
  getOrCreateCreatorAgentWalletMock,
  enableCswAgentMock,
  getOrCreateCreatorXmtpAgentMock,
  resolveCoinPartiesMock,
} = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
  readJsonBodyMock: vi.fn(async () => ({})),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  getOrCreateCreatorAgentWalletMock: vi.fn(async () => ({
    walletId: 'wallet_1',
    address: '0x0000000000000000000000000000000000000abc',
  })),
  enableCswAgentMock: vi.fn(async () => ({
    creatorAddress: '0x00000000000000000000000000000000000000aa',
    xmtpAgentAddress: '0x00000000000000000000000000000000000000aa',
    agentType: 'csw',
    cswAddress: '0x00000000000000000000000000000000000000aa',
    listedPublicly: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  getOrCreateCreatorXmtpAgentMock: vi.fn(async () => ({
    creatorAddress: '0x00000000000000000000000000000000000000aa',
    xmtpAgentAddress: '0x00000000000000000000000000000000000000ff',
    agentType: 'eoa',
    listedPublicly: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  resolveCoinPartiesMock: vi.fn(async () => ({
    creator: '0x00000000000000000000000000000000000000aa',
    payoutRecipient: '0x00000000000000000000000000000000000000aa',
  })),
}))

vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readJsonBody: readJsonBodyMock,
  readSessionFromRequest: readSessionFromRequestMock,
}))

vi.mock('../../server/auth/_siwa.js', () => ({
  readSiwaAgentFromRequest: readSiwaAgentFromRequestMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: getOrCreateCreatorAgentWalletMock,
}))

vi.mock('../../server/_lib/creatorXmtpAgents.js', () => ({
  enableCswAgent: enableCswAgentMock,
  getOrCreateCreatorXmtpAgent: getOrCreateCreatorXmtpAgentMock,
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: resolveCoinPartiesMock,
  isAddressLike: (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v),
}))

vi.mock('../../server/_lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: vi.fn(async () => true),
  })),
  http: vi.fn(() => ({ transport: 'http' })),
}))

vi.mock('viem/chains', () => ({
  base: {},
}))

function createDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const text = strings.join(' ').toLowerCase().replace(/\s+/g, ' ')
      if (text.includes('select address from allowlist')) return { rows: [] }
      if (text.includes('insert into allowlist')) return { rows: [] }
      return { rows: [] }
    }),
  }
}

describe('v1/creators/quickstart auth parity', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb())
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue(null)
    restoreEnv = applyEnv({
      ZORA_SERVER_API_KEY: undefined,
      NEYNAR_API_KEY: undefined,
      VITE_NEYNAR_API_KEY: undefined,
    })
  })

  afterEach(() => {
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns 401 when no session and no SIWA', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(401)
  })

  it('accepts session principal', async () => {
    readSessionFromRequestMock.mockReturnValue({ address: '0x00000000000000000000000000000000000000aa' } as any)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })

  it('accepts SIWA principal when session is missing', async () => {
    readSessionFromRequestMock.mockReturnValue(null)
    readSiwaAgentFromRequestMock.mockReturnValue({
      address: '0x00000000000000000000000000000000000000aa',
      agentId: 42,
      agentRegistry: 'eip155:8453:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432',
      chainId: 8453,
    } as any)
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()
    await handler(req as any, res as any)
    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
  })
})
