import type { OperatorAction } from './operatorActions.js'
import { parseOperatorAction } from './operatorActions.js'

export type AsyncVerbKind = 'vault.provision' | 'vault.maintenance' | 'vault.settle' | 'operator.action'

export type ControlPlaneJobSpec = {
  path: string
  body: Record<string, unknown>
  stageKind: string
}

const PROVISION_PATH = '/api/keeper/control-plane/provision'
const MAINTENANCE_PATH = '/api/keeper/control-plane/maintenance'
const SETTLE_PATH = '/api/keeper/control-plane/settle'
const OPERATOR_ACTION_PATH = '/api/keeper/control-plane/operator-action'

export function buildControlPlaneJobSpec(input: {
  operationKind: AsyncVerbKind
  operationId: string
  stageId: string
  vaultAddress: `0x${string}`
  payload: Record<string, unknown>
}): ControlPlaneJobSpec {
  const base = {
    operationId: input.operationId,
    stageId: input.stageId,
    vaultAddress: input.vaultAddress,
  }

  switch (input.operationKind) {
    case 'vault.provision':
      return {
        path: PROVISION_PATH,
        stageKind: 'vault.provision',
        body: {
          ...base,
          chainId: input.payload.chainId ?? null,
          creatorAddress: input.payload.creatorAddress ?? null,
          strategyVariant: input.payload.strategyVariant ?? null,
          requestedBy: input.payload.requestedBy ?? null,
        },
      }
    case 'vault.maintenance':
      return {
        path: MAINTENANCE_PATH,
        stageKind: 'vault.maintenance',
        body: {
          ...base,
          mode: input.payload.mode ?? 'standard',
        },
      }
    case 'vault.settle':
      return {
        path: SETTLE_PATH,
        stageKind: 'vault.settle',
        body: {
          ...base,
          graduatedAt: input.payload.graduatedAt ?? null,
          settledAt: input.payload.settledAt ?? null,
          settlementStage: input.payload.settlementStage ?? null,
        },
      }
    case 'operator.action': {
      const action = resolveOperatorAction(input.payload)
      return {
        path: OPERATOR_ACTION_PATH,
        stageKind: `operator.${action.type}`,
        body: {
          ...base,
          action,
        },
      }
    }
    default:
      throw new Error(`unsupported_operation_kind:${input.operationKind}`)
  }
}

function resolveOperatorAction(payload: Record<string, unknown>): OperatorAction {
  if (payload.action && typeof payload.action === 'object' && !Array.isArray(payload.action)) {
    return parseOperatorAction(payload.action)
  }
  return parseOperatorAction({
    type: payload.actionType,
    vaultAddress: payload.vaultAddress,
    ...(payload.payload && typeof payload.payload === 'object' ? payload.payload : {}),
  })
}

export function isAllowedControlPlaneInternalPath(path: string): boolean {
  return (
    path === PROVISION_PATH ||
    path === MAINTENANCE_PATH ||
    path === SETTLE_PATH ||
    path === OPERATOR_ACTION_PATH
  )
}
