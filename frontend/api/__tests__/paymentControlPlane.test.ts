import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  startControlPlaneOperationMock,
  createControlPlaneStageMock,
  transitionOperationStatusMock,
  transitionStageStatusMock,
  addControlPlaneEventMock,
} = vi.hoisted(() => ({
  startControlPlaneOperationMock: vi.fn(async () => ({
    operationId: 'op_payment_1',
    persisted: true,
    reused: false,
  })),
  createControlPlaneStageMock: vi.fn(async () => ({
    stageId: 'stage_payment_1',
    persisted: true,
  })),
  transitionOperationStatusMock: vi.fn<(input: { nextStatus: string }) => Promise<void>>(async () => undefined),
  transitionStageStatusMock: vi.fn<(input: { nextStatus: string }) => Promise<void>>(async () => undefined),
  addControlPlaneEventMock: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/controlPlane/operations.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../server/_lib/controlPlane/operations.js')
  return {
    ...actual,
    startControlPlaneOperation: startControlPlaneOperationMock,
    createControlPlaneStage: createControlPlaneStageMock,
    transitionOperationStatus: transitionOperationStatusMock,
    transitionStageStatus: transitionStageStatusMock,
    addControlPlaneEvent: addControlPlaneEventMock,
  }
})

import {
  recordPaymentActivationQueued,
  recordPaymentProvisioningDispatch,
} from '../../server/_lib/controlPlane/paymentControlPlane.js'

describe('paymentControlPlane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates queued payment activation operation and stage', async () => {
    const result = await recordPaymentActivationQueued({
      orderId: 'activation:42',
      activationId: 42,
      provider: 'stripe',
      providerEventId: 'evt_123',
      creatorToken: '0x1111111111111111111111111111111111111111',
      featureKey: 'charm_active_lp',
      paymentSource: 'stripe',
      amountAtomic: 100_000_000n,
      currency: 'USDC',
    })

    expect(result.operationId).toBe('op_payment_1')
    expect(result.stageId).toBe('stage_payment_1')
    expect(startControlPlaneOperationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationKind: 'payment.activation',
        scopeType: 'activation',
        scopeId: 'activation:42',
        idempotencyKey: 'activation:42',
      }),
    )
    expect(transitionOperationStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ nextStatus: 'queued', reason: 'payment_provisioning_queued' }),
    )
    expect(addControlPlaneEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'payment.provider_event_recorded' }),
    )
  })

  it('skips stage creation when operation idempotency key is reused', async () => {
    startControlPlaneOperationMock.mockResolvedValueOnce({
      operationId: 'op_payment_existing',
      persisted: true,
      reused: true,
    })

    const result = await recordPaymentActivationQueued({
      orderId: 'activation:99',
      activationId: 99,
      provider: 'x402',
      providerEventId: '0xabc',
      creatorToken: '0x1111111111111111111111111111111111111111',
      featureKey: 'ajna_sleeve',
      paymentSource: 'x402_base',
      amountAtomic: 100_000_000n,
      currency: 'USDC',
    })

    expect(result.reused).toBe(true)
    expect(result.stageId).toBe('')
    expect(createControlPlaneStageMock).not.toHaveBeenCalled()
  })

  it('records provisioning dispatch terminal status via running', async () => {
    await recordPaymentProvisioningDispatch({
      operationId: 'op_payment_1',
      stageId: 'stage_payment_1',
      ok: false,
      note: 'dispatch failed: unsupported_feature',
    })

    const stageStatuses = transitionStageStatusMock.mock.calls.map((call) => call[0].nextStatus)
    const operationStatuses = transitionOperationStatusMock.mock.calls.map((call) => call[0].nextStatus)
    expect(stageStatuses).toEqual(['running', 'manual_review'])
    expect(operationStatuses).toEqual(['running', 'manual_review'])
    expect(transitionStageStatusMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ nextStatus: 'manual_review', errorCode: 'provision_dispatch_failed' }),
    )
  })
})
