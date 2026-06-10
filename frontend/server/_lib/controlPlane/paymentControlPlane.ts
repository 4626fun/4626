import { loadControlPlanePolicy } from './policy.js'
import {
  addControlPlaneEvent,
  createControlPlaneStage,
  startControlPlaneOperation,
  transitionOperationStatus,
  transitionStageStatus,
} from './operations.js'

export type RecordPaymentActivationQueuedInput = {
  orderId: string
  activationId: number
  provider: 'stripe' | 'x402' | 'manual' | 'usdc_base'
  providerEventId: string
  creatorToken: string
  featureKey: string
  paymentSource: string
  amountAtomic: bigint
  currency: string
  requestedBy?: string | null
  metadata?: Record<string, unknown> | null
}

export type RecordPaymentActivationQueuedResult = {
  operationId: string
  stageId: string
  persisted: boolean
  reused: boolean
}

export async function recordPaymentActivationQueued(
  input: RecordPaymentActivationQueuedInput,
): Promise<RecordPaymentActivationQueuedResult> {
  const scopeId = String(input.orderId).trim().toLowerCase()
  const policyVersion = loadControlPlanePolicy().policyVersion
  const operation = await startControlPlaneOperation({
    operationKind: 'payment.activation',
    scopeType: 'activation',
    scopeId,
    lockScope: 'payment.activation',
    lockKey: scopeId,
    requestedBy: input.requestedBy ?? 'system',
    idempotencyKey: scopeId,
    schemaVersion: 'v1',
    policyVersion,
    input: {
      orderId: input.orderId,
      activationId: input.activationId,
      provider: input.provider,
      providerEventId: input.providerEventId,
      creatorToken: input.creatorToken,
      featureKey: input.featureKey,
      paymentSource: input.paymentSource,
      amountAtomic: input.amountAtomic.toString(),
      currency: input.currency,
      ...(input.metadata ?? {}),
    },
  })

  if (operation.reused) {
    return {
      operationId: operation.operationId,
      stageId: '',
      persisted: operation.persisted,
      reused: true,
    }
  }

  if (!operation.persisted) {
    return {
      operationId: operation.operationId,
      stageId: '',
      persisted: false,
      reused: false,
    }
  }

  const stage = await createControlPlaneStage({
    operationId: operation.operationId,
    stageKind: 'payment.provision_dispatch',
    status: 'requested',
    input: {
      orderId: input.orderId,
      activationId: input.activationId,
      provider: input.provider,
    },
  })

  await transitionOperationStatus({
    operationId: operation.operationId,
    nextStatus: 'queued',
    reason: 'payment_provisioning_queued',
    actor: input.requestedBy ?? 'system',
    data: {
      orderId: input.orderId,
      provider: input.provider,
      providerEventId: input.providerEventId,
    },
  })
  await transitionStageStatus({
    stageId: stage.stageId,
    nextStatus: 'queued',
    reason: 'payment_provisioning_queued',
    actor: input.requestedBy ?? 'system',
  })
  await addControlPlaneEvent({
    operationId: operation.operationId,
    stageId: stage.stageId,
    eventType: 'payment.provider_event_recorded',
    message: `${input.provider}_payment_recorded`,
    data: {
      orderId: input.orderId,
      provider: input.provider,
      providerEventId: input.providerEventId,
      paymentSource: input.paymentSource,
      activationId: input.activationId,
      creatorToken: input.creatorToken,
      featureKey: input.featureKey,
    },
  })

  return {
    operationId: operation.operationId,
    stageId: stage.stageId,
    persisted: operation.persisted && stage.persisted,
    reused: false,
  }
}

export async function recordPaymentProvisioningDispatch(input: {
  operationId: string
  stageId: string
  ok: boolean
  note: string
  actor?: string | null
}): Promise<void> {
  if (!input.stageId) return
  const actor = input.actor ?? 'system'
  const terminalStatus = input.ok ? 'succeeded' : 'manual_review'
  const terminalReason = input.ok ? 'provision_dispatch_enqueued' : 'provision_dispatch_failed'
  const terminalExtras = input.ok
    ? { result: { note: input.note } }
    : {
        result: { note: input.note },
        errorCode: 'provision_dispatch_failed',
        errorMessage: input.note,
      }

  await transitionStageStatus({
    stageId: input.stageId,
    nextStatus: 'running',
    reason: 'provision_dispatch_started',
    actor,
  })
  await transitionOperationStatus({
    operationId: input.operationId,
    nextStatus: 'running',
    reason: 'provision_dispatch_started',
    actor,
  })
  await transitionStageStatus({
    stageId: input.stageId,
    nextStatus: terminalStatus,
    reason: terminalReason,
    actor,
    ...terminalExtras,
  })
  await transitionOperationStatus({
    operationId: input.operationId,
    nextStatus: terminalStatus,
    reason: terminalReason,
    actor,
    ...terminalExtras,
  })
}
