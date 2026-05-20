import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAddress } from 'viem'

import refreshHandler from '../_handlers/creator/ethos/_refresh.js'
import { COOKIE_SESSION } from '../../packages/server-core/src/index.js'
import { makeSessionToken } from '../../server/auth/_shared.js'
import { createMockReq, createMockRes } from './helpers'
import { ETHOS_PAID_REFRESH_PRICE_USDC } from '../../server/_lib/creatorEthos/paidRefresh.js'

const {
  getDbMock,
  verifyUsdcPaymentMock,
  runPaidCreatorEthosRefreshMock,
  loadCreatorEthosProjectionByAddressesMock,
  insertCreatorEthosRefreshOrderMock,
  getEthosPaidRefreshCooldownMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  verifyUsdcPaymentMock: vi.fn(),
  runPaidCreatorEthosRefreshMock: vi.fn(),
  loadCreatorEthosProjectionByAddressesMock: vi.fn(),
  insertCreatorEthosRefreshOrderMock: vi.fn(),
  getEthosPaidRefreshCooldownMock: vi.fn(),
}))

vi.mock('../../packages/server-core/src/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../packages/server-core/src/index.js')>()
  return {
    ...actual,
    getDb: getDbMock,
    isDbConfigured: () => true,
  }
})

vi.mock('../../server/_lib/creatorStrategy/usdcPayment.js', () => ({
  BASE_USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  resolveProtocolTreasuryForUsdcPayments: () => getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'),
  verifyUsdcPayment: verifyUsdcPaymentMock,
}))

vi.mock('../../server/_lib/creatorEthos/paidRefresh.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/_lib/creatorEthos/paidRefresh.js')>()
  return {
    ...actual,
    runPaidCreatorEthosRefresh: runPaidCreatorEthosRefreshMock,
    insertCreatorEthosRefreshOrder: insertCreatorEthosRefreshOrderMock,
    getEthosPaidRefreshCooldown: getEthosPaidRefreshCooldownMock,
  }
})

vi.mock('../../server/_lib/zora/creatorEthosProjection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/_lib/zora/creatorEthosProjection.js')>()
  return {
    ...actual,
    loadCreatorEthosProjectionByAddresses: loadCreatorEthosProjectionByAddressesMock,
  }
})

describe('creator ethos paid refresh', () => {
  const creator = '0x0000000000000000000000000000000000000abc'
  const payer = '0x0000000000000000000000000000000000000001'
  const txHash = `0x${'a'.repeat(64)}`

  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue({ sql: vi.fn() })
    getEthosPaidRefreshCooldownMock.mockResolvedValue({
      inCooldown: false,
      retryAfterSeconds: null,
      lastOrderAt: null,
    })
    loadCreatorEthosProjectionByAddressesMock.mockResolvedValue(new Map())
    verifyUsdcPaymentMock.mockResolvedValue({
      ok: true,
      txHash,
      from: payer,
      to: getAddress('0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'),
      value: ETHOS_PAID_REFRESH_PRICE_USDC,
      blockNumber: 1n,
    })
    runPaidCreatorEthosRefreshMock.mockResolvedValue({
      ok: true,
      coinAddress: '0x0000000000000000000000000000000000000123',
      ethosScore: 1600,
      ethosLevel: 'reputable',
      ethosScoreSource: 'canonical_social',
    })
    insertCreatorEthosRefreshOrderMock.mockResolvedValue({ ok: true })
  })

  it('charges $0.10 USDC minimum and returns refreshed score', async () => {
    const sessionToken = makeSessionToken({ address: payer })
    const req = createMockReq({
      method: 'POST',
      headers: { cookie: `${COOKIE_SESSION}=${sessionToken}` },
      rawBody: JSON.stringify({ creatorAddress: creator, paymentTxHash: txHash }),
    })
    const res = createMockRes()

    await refreshHandler(req, res)

    expect(res.statusCode).toBe(200)
    expect(verifyUsdcPaymentMock).toHaveBeenCalledWith(
      expect.objectContaining({ minAmount: 100_000n }),
    )
    expect(res.body?.data?.ethosScore).toBe(1600)
  })
})
