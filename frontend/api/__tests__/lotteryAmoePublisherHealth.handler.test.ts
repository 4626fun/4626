import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv, createMockReq, createMockRes } from './helpers'

const {
  isAuthorizedCronMock,
  isAmoeZkSubmitEnabledMock,
  readLotteryAmoeRouterAddressMock,
  isAmoeLedgerPublisherEnabledMock,
  readAmoeLedgerPublisherSmartWalletMock,
  readBaseRpcUrlForPublisherMock,
  requirePublisherDbMock,
  isAmoeAllowlistPublisherEnabledMock,
  computeAmoeEpochMock,
  readAllowlistRootOfMock,
  readPointsLedgerRootOfMock,
  createPublicClientMock,
} = vi.hoisted(() => ({
  isAuthorizedCronMock: vi.fn(),
  isAmoeZkSubmitEnabledMock: vi.fn(),
  readLotteryAmoeRouterAddressMock: vi.fn(),
  isAmoeLedgerPublisherEnabledMock: vi.fn(),
  readAmoeLedgerPublisherSmartWalletMock: vi.fn(),
  readBaseRpcUrlForPublisherMock: vi.fn(),
  requirePublisherDbMock: vi.fn(),
  isAmoeAllowlistPublisherEnabledMock: vi.fn(),
  computeAmoeEpochMock: vi.fn(),
  readAllowlistRootOfMock: vi.fn(),
  readPointsLedgerRootOfMock: vi.fn(),
  createPublicClientMock: vi.fn(),
}))

vi.mock('../../server/_lib/lottery/cronAuth.js', () => ({
  isAuthorizedCron: isAuthorizedCronMock,
}))

vi.mock('../../server/_lib/lottery/amoeSubmitZk.js', () => ({
  isAmoeZkSubmitEnabled: isAmoeZkSubmitEnabledMock,
  readLotteryAmoeRouterAddress: readLotteryAmoeRouterAddressMock,
  computeAmoeEpoch: computeAmoeEpochMock,
}))

vi.mock('../../server/_lib/lottery/amoeLedgerPublisher.js', () => ({
  isAmoeLedgerPublisherEnabled: isAmoeLedgerPublisherEnabledMock,
  readAmoeLedgerPublisherSmartWallet: readAmoeLedgerPublisherSmartWalletMock,
  readBaseRpcUrlForPublisher: readBaseRpcUrlForPublisherMock,
  requirePublisherDb: requirePublisherDbMock,
}))

vi.mock('../../server/_lib/lottery/amoeAllowlistPublisher.js', () => ({
  isAmoeAllowlistPublisherEnabled: isAmoeAllowlistPublisherEnabledMock,
}))

vi.mock('../../server/_lib/lottery/amoePublisherRoleGuard.js', async () => {
  const actual = await vi.importActual<
    typeof import('../../server/_lib/lottery/amoePublisherRoleGuard.js')
  >('../../server/_lib/lottery/amoePublisherRoleGuard.js')
  return {
    ...actual,
    readAllowlistRootOf: readAllowlistRootOfMock,
    readPointsLedgerRootOf: readPointsLedgerRootOfMock,
  }
})

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem')
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
  }
})

import { getV1ApiHandler } from '../_handlers/_routes.v1.js'

const VALID_SECRET = 'cron-secret-of-sufficient-length-32chars'
const PROTOCOL = '0x793ca28123cba3ca3c20b9c6c67f37510c89c145'
const ROUTER = '0x630c3769cf1d80c6cb8ccb7c011f5a76904c4c1e'
const ROOT = ('0x' + '11'.repeat(32)) as `0x${string}`
const ZERO = ('0x' + '00'.repeat(32)) as `0x${string}`

describe('lottery/amoe/publisher-health handler', () => {
  let restoreEnv: (() => void) | undefined

  beforeEach(() => {
    restoreEnv = applyEnv({ CRON_SECRET: VALID_SECRET })
    isAuthorizedCronMock.mockReturnValue(true)
    isAmoeZkSubmitEnabledMock.mockReturnValue(true)
    readLotteryAmoeRouterAddressMock.mockReturnValue(ROUTER)
    isAmoeLedgerPublisherEnabledMock.mockReturnValue(true)
    isAmoeAllowlistPublisherEnabledMock.mockReturnValue(true)
    readAmoeLedgerPublisherSmartWalletMock.mockReturnValue(PROTOCOL)
    readBaseRpcUrlForPublisherMock.mockReturnValue('https://mainnet.base.org')
    computeAmoeEpochMock.mockReturnValue(84n)
    readAllowlistRootOfMock.mockResolvedValue(ROOT)
    readPointsLedgerRootOfMock.mockResolvedValue(ZERO)
    createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'allowlistPublisher') return PROTOCOL
        if (functionName === 'pointsLedgerPublisher') return PROTOCOL
        throw new Error(`unexpected ${functionName}`)
      }),
    })
    requirePublisherDbMock.mockResolvedValue({
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const q = strings.join(' ')
        if (q.includes('amoe_wallet_allowlist_snapshots')) {
          return { rows: [{ publish_tx_hash: '0xabc', publish_confirmed_at: null }] }
        }
        if (q.includes('finished_no_op')) {
          return { rows: [{ '?column?': 1 }] }
        }
        return { rows: [] }
      }),
    })
  })

  afterEach(() => {
    restoreEnv?.()
    vi.clearAllMocks()
  })

  it('routes publisher-health to a handler', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publisher-health')
    expect(typeof handler).toBe('function')
  })

  it('returns 401 when unauthorized', async () => {
    isAuthorizedCronMock.mockReturnValue(false)
    const handler = await getV1ApiHandler('lottery/amoe/publisher-health')
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(401)
    expect(res.body).toMatchObject({ ok: false, error: 'unauthorized' })
  })

  it('returns 200 ok when roles match and allowlist root set', async () => {
    const handler = await getV1ApiHandler('lottery/amoe/publisher-health')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({
      ok: true,
      roleOk: true,
      latestClosedEpoch: '83',
      allowlistRootSet: true,
      ledgerEmptyOk: true,
      dbAllowlistPublished: true,
    })
  })

  it('returns 503 when publisher role drifts', async () => {
    createPublicClientMock.mockReturnValue({
      readContract: vi.fn(async () => '0xAb6d5C10b03300326CD7fAb7267Ae192842967b5'),
    })
    const handler = await getV1ApiHandler('lottery/amoe/publisher-health')
    const req = createMockReq({
      method: 'GET',
      headers: { authorization: `Bearer ${VALID_SECRET}` },
    })
    const res = createMockRes()
    await handler!(req, res)
    expect(res.statusCode).toBe(503)
    expect(res.body.ok).toBe(false)
    expect(res.body.roleOk).toBe(false)
  })
})
