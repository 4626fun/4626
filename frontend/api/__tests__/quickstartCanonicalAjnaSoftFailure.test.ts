import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/v1/creators/_quickstart.ts'
import { applyEnv, createMockReq, createMockRes } from './helpers'

const CREATOR_ADDRESS = '0x00000000000000000000000000000000000000aa'

const {
  readSessionFromRequestMock,
  readSiwaAgentFromRequestMock,
  readJsonBodyMock,
  getDbMock,
  isDbConfiguredMock,
  resolvePersistedWalletIdentityMock,
  resolveAuthorizedWalletProfileMock,
} = vi.hoisted(() => ({
  readSessionFromRequestMock: vi.fn(),
  readSiwaAgentFromRequestMock: vi.fn(),
  readJsonBodyMock: vi.fn(async () => ({})),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  resolvePersistedWalletIdentityMock: vi.fn(),
  resolveAuthorizedWalletProfileMock: vi.fn(),
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

vi.mock('../../server/_lib/canonicalWalletResolver.js', () => ({
  resolvePersistedWalletIdentity: resolvePersistedWalletIdentityMock,
  resolveAuthorizedWalletProfile: resolveAuthorizedWalletProfileMock,
}))

vi.mock('../../server/_lib/creatorAgentWallets.js', () => ({
  getOrCreateCreatorAgentWallet: vi.fn(),
}))

vi.mock('../../server/_lib/creatorXmtpAgents.js', () => ({
  enableCswAgent: vi.fn(),
  getOrCreateCreatorXmtpAgent: vi.fn(),
}))

vi.mock('../../server/_lib/coinParties.js', () => ({
  resolveCoinParties: vi.fn(),
  isAddressLike: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
}))

vi.mock('../../server/_lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

describe('v1/creators/quickstart canonical Ajna hinting', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(createDb())
    readSessionFromRequestMock.mockReturnValue({ address: CREATOR_ADDRESS } as any)
    readSiwaAgentFromRequestMock.mockReturnValue(null)
    readJsonBodyMock.mockResolvedValue({})
    resolvePersistedWalletIdentityMock.mockRejectedValue(new Error('persisted lookup failed'))
    resolveAuthorizedWalletProfileMock.mockResolvedValue({
      profileId: 1,
      canonicalSmartWalletAddress: CREATOR_ADDRESS,
      activeOwnerWalletAddress: null,
    })
    restoreEnv = applyEnv({
      ZORA_SERVER_API_KEY: undefined,
    })
  })

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('fails soft when persisted wallet identity enrichment errors', async () => {
    const req = createMockReq({ method: 'POST' })
    const res = createMockRes()

    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.canonicalAjnaAutomation).toEqual({
      available: false,
      cswAddress: null,
      embeddedEoaAddress: null,
    })
  })
})
