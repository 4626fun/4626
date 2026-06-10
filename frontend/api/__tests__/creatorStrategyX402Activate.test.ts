import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockReq, createMockRes } from './helpers'

const SESSION_ADDRESS = '0x1111111111111111111111111111111111111111'
const CREATOR_TOKEN = '0x2222222222222222222222222222222222222222'
const TREASURY = '0x3333333333333333333333333333333333333333'
const SETTLED_TX_HASH = '0x' + 'ab'.repeat(32)

const {
  getDbMock,
  txDbSqlMock,
  runInTransactionMock,
  hasAnyLiveActivationRowMock,
  insertPendingActivationMock,
  settleX402PaymentMock,
  parseXPaymentHeaderMock,
  validateX402AuthorizationMock,
  buildPaymentRequirementsMock,
  upsertPaymentOrderMock,
  recordPaymentEventMock,
  dispatchProvisioningMock,
  recordPaymentActivationQueuedMock,
  recordPaymentProvisioningDispatchMock,
} = vi.hoisted(() => {
  const txDbSqlMock = vi.fn(async () => ({ rows: [] }))
  return {
    getDbMock: vi.fn(async () => ({ sql: vi.fn(async () => ({ rows: [] })) })),
    txDbSqlMock,
    runInTransactionMock: vi.fn(async (fn: (db: unknown) => Promise<unknown>) =>
      fn({ sql: txDbSqlMock }),
    ),
    hasAnyLiveActivationRowMock: vi.fn(async () => false),
    insertPendingActivationMock: vi.fn(),
    settleX402PaymentMock: vi.fn(async () => ({
      ok: true as const,
      txHash: SETTLED_TX_HASH,
      blockNumber: 123n,
      from: SESSION_ADDRESS,
      to: TREASURY,
      value: 499_000_000n,
    })),
    parseXPaymentHeaderMock: vi.fn(() => ({
      ok: true as const,
      payment: {
        scheme: 'exact',
        network: 'base',
        x402_version: 1,
        payload: { authorization: { nonce: '0x' + '11'.repeat(32) } },
      },
    })),
    validateX402AuthorizationMock: vi.fn(() => ({ ok: true as const })),
    buildPaymentRequirementsMock: vi.fn(() => ({ accepts: [] })),
    upsertPaymentOrderMock: vi.fn(async () => undefined),
    recordPaymentEventMock: vi.fn(async () => undefined),
    dispatchProvisioningMock: vi.fn(async () => ({ ok: true as const, note: 'queued' })),
    recordPaymentActivationQueuedMock: vi.fn(async () => ({
      operationId: 'op_1',
      stageId: 'stage_1',
      persisted: true,
      reused: false,
    })),
    recordPaymentProvisioningDispatchMock: vi.fn(async () => undefined),
  }
})

vi.mock('@4626/server-core', () => ({
  handleOptions: vi.fn(() => false),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
  readBoundedJsonObjectBody: vi.fn(async (req: any) => req.body ?? {}),
  getDb: getDbMock,
  isDbConfigured: vi.fn(() => true),
  getSessionAddress: vi.fn(() => SESSION_ADDRESS),
  RATE_LIMITS: { creatorQuickstart: { windowMs: 60_000, maxRequests: 20 } },
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60_000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  rateLimitKey: vi.fn((...parts: string[]) => parts.join(':')),
  runInTransaction: runInTransactionMock,
}))

vi.mock('../../server/_lib/creatorStrategy/catalog.js', () => ({
  getCreatorStrategyFeature: vi.fn(() => ({
    key: 'vault_full_deploy',
    displayName: 'Full Deploy Bundle',
    priceUsdc: 499_000_000n,
    provisionerTag: 'vault_full_deploy',
  })),
  getRetiredCreatorStrategyFeatureMessage: vi.fn(() => null),
}))

vi.mock('../../server/_lib/creatorStrategy/bundleEntitlements.js', () => ({
  getAlacarteDeployPurchaseBlockedMessage: vi.fn(() => null),
}))

vi.mock('../../server/_lib/creatorStrategy/activations.js', () => ({
  hasAnyLiveActivationRow: hasAnyLiveActivationRowMock,
  insertPendingActivation: insertPendingActivationMock,
  toCreatorStrategyFeatureDto: vi.fn((row: any) => row),
}))

vi.mock('../../server/_lib/creatorStrategy/usdcPayment.js', () => ({
  BASE_USDC_ADDRESS: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  resolveProtocolTreasuryForUsdcPayments: vi.fn(() => TREASURY),
}))

vi.mock('../../server/_lib/creatorStrategy/priceOverrides.js', () => ({
  findActivePriceOverride: vi.fn(async () => null),
  applyPriceOverride: vi.fn(() => ({
    effectivePriceUsdc: 499_000_000n,
    appliedOverrideId: null,
    discountBps: null,
  })),
}))

vi.mock('../../server/_lib/creatorStrategy/x402.js', () => ({
  buildPaymentRequirements: buildPaymentRequirementsMock,
  parseXPaymentHeader: parseXPaymentHeaderMock,
  settleX402Payment: settleX402PaymentMock,
  validateX402Authorization: validateX402AuthorizationMock,
}))

vi.mock('../../server/_lib/creatorStrategy/provisioner.js', () => ({
  dispatchProvisioning: dispatchProvisioningMock,
}))

vi.mock('../../server/_lib/creatorStrategy/paymentLedger.js', () => ({
  recordPaymentEvent: recordPaymentEventMock,
}))

vi.mock('../../server/_lib/creatorStrategy/paymentOrders.js', () => ({
  upsertPaymentOrder: upsertPaymentOrderMock,
}))

vi.mock('../../server/_lib/controlPlane/paymentControlPlane.js', () => ({
  recordPaymentActivationQueued: recordPaymentActivationQueuedMock,
  recordPaymentProvisioningDispatch: recordPaymentProvisioningDispatchMock,
}))

import handler from '../_handlers/creator/strategy/_x402-activate.ts'

function buildPaidRequest() {
  return createMockReq({
    method: 'POST',
    headers: { 'x-payment': 'ZmFrZS1wYXltZW50' },
    body: { creatorToken: CREATOR_TOKEN, featureKey: 'vault_full_deploy' },
  })
}

const ACTIVATION_ROW = {
  id: 42,
  creatorToken: CREATOR_TOKEN,
  featureKey: 'vault_full_deploy',
  status: 'pending',
  priceUsdcPaid: 499_000_000n,
  paymentTxHash: SETTLED_TX_HASH,
  paymentFrom: SESSION_ADDRESS,
  paymentTo: TREASURY,
  paymentVerifiedAt: new Date().toISOString(),
  provisionedAt: null,
  failedAt: null,
  refundedAt: null,
  provisionerRef: null,
  failureReason: null,
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('x402 activate handler (C-1 regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasAnyLiveActivationRowMock.mockResolvedValue(false)
    insertPendingActivationMock.mockResolvedValue({ ok: true, row: ACTIVATION_ROW })
  })

  it('never settles on-chain when a live activation row already exists', async () => {
    hasAnyLiveActivationRowMock.mockResolvedValue(true)

    const res = createMockRes()
    await handler(buildPaidRequest(), res)

    expect(res.statusCode).toBe(409)
    expect(res.body).toMatchObject({
      success: false,
      error: 'activation_insert_failed',
      reason: 'live_activation_exists',
    })
    expect(settleX402PaymentMock).not.toHaveBeenCalled()
    expect(insertPendingActivationMock).not.toHaveBeenCalled()
  })

  it('blocks the 402 requirements path too when a live activation exists', async () => {
    hasAnyLiveActivationRowMock.mockResolvedValue(true)

    const res = createMockRes()
    await handler(
      createMockReq({
        method: 'POST',
        body: { creatorToken: CREATOR_TOKEN, featureKey: 'vault_full_deploy' },
      }),
      res,
    )

    expect(res.statusCode).toBe(409)
    expect(buildPaymentRequirementsMock).not.toHaveBeenCalled()
    expect(settleX402PaymentMock).not.toHaveBeenCalled()
  })

  it('records a durable orphan order + event when insert fails after settlement', async () => {
    insertPendingActivationMock.mockResolvedValue({
      ok: false,
      reason: 'live_activation_exists',
      message: 'A pending or active activation already exists for this creator and feature',
    })

    const res = createMockRes()
    await handler(buildPaidRequest(), res)

    expect(res.statusCode).toBe(409)
    expect(settleX402PaymentMock).toHaveBeenCalledTimes(1)

    // The orphan record survives outside the rolled-back transaction.
    expect(upsertPaymentOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: `orphaned-x402:${SETTLED_TX_HASH}`,
        status: 'manual_review',
        amountAtomic: 499_000_000n,
        currency: 'USDC',
      }),
    )
    expect(recordPaymentEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'x402',
        providerEventId: SETTLED_TX_HASH,
        orderId: `orphaned-x402:${SETTLED_TX_HASH}`,
        eventType: 'x402.settlement_orphaned',
      }),
    )
    // The orphan writes must NOT use the transactional db handle.
    const upsertCalls = upsertPaymentOrderMock.mock.calls as unknown as Array<[Record<string, any>]>
    const orphanOrderCall = upsertCalls.find(
      (call) => call[0]?.orderId === `orphaned-x402:${SETTLED_TX_HASH}`,
    )
    expect(orphanOrderCall?.[0]?.db?.sql).not.toBe(txDbSqlMock)
  })

  it('records a durable orphan record when the transaction throws after settlement', async () => {
    runInTransactionMock.mockRejectedValueOnce(new Error('connection reset'))

    const res = createMockRes()
    await handler(buildPaidRequest(), res)

    expect(res.statusCode).toBe(500)
    expect(settleX402PaymentMock).toHaveBeenCalledTimes(1)
    expect(recordPaymentEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerEventId: SETTLED_TX_HASH,
        eventType: 'x402.settlement_orphaned',
        payload: expect.objectContaining({ failureReason: 'db_error' }),
      }),
    )
  })

  it('happy path: pre-check passes, settlement and activation persist, no orphan record', async () => {
    const res = createMockRes()
    await handler(buildPaidRequest(), res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ success: true })
    expect(hasAnyLiveActivationRowMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ featureKey: 'vault_full_deploy' }),
    )
    expect(settleX402PaymentMock).toHaveBeenCalledTimes(1)
    expect(insertPendingActivationMock).toHaveBeenCalledTimes(1)
    const eventTypes = (recordPaymentEventMock.mock.calls as unknown as Array<[Record<string, any>]>).map(
      (call) => call[0]?.eventType,
    )
    expect(eventTypes).toContain('x402.authorization_settled')
    expect(eventTypes).not.toContain('x402.settlement_orphaned')
  })
})
