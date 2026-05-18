export type VaultSweepAction = {
  type: 'vault.sweep'
  vaultAddress: string
  ccaStrategyAddress: string
}

export type VaultTendAction = {
  type: 'vault.tend'
  vaultAddress: string
}

export type VaultReportAction = {
  type: 'vault.report'
  vaultAddress: string
}

export type StrategyAjnaRebucketAction = {
  type: 'strategy.ajna.rebucket'
  vaultAddress: string
  targetBucket: number
}

export type StrategyCharmRebalanceAction = {
  type: 'strategy.charm.rebalance'
  vaultAddress: string
  charmVaultAddress: string
}

export type SolanaReconcileAction = {
  type: 'solana.reconcile'
  workflow: string
  action: string
  checkpointKey: string
}

export type OperatorAction =
  | VaultSweepAction
  | VaultTendAction
  | VaultReportAction
  | StrategyAjnaRebucketAction
  | StrategyCharmRebalanceAction
  | SolanaReconcileAction

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readAddress(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) throw new Error('invalid_address')
  return normalized
}

function readString(value: unknown, code: string): string {
  const out = typeof value === 'string' ? value.trim() : ''
  if (!out) throw new Error(code)
  return out
}

function readInt(value: unknown, code: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(code)
  return n
}

export function parseOperatorAction(payload: unknown): OperatorAction {
  if (!isRecord(payload)) throw new Error('invalid_operator_action')
  const type = readString(payload.type, 'invalid_operator_action_type')
  switch (type) {
    case 'vault.sweep':
      return {
        type,
        vaultAddress: readAddress(payload.vaultAddress),
        ccaStrategyAddress: readAddress(payload.ccaStrategyAddress),
      }
    case 'vault.tend':
      return {
        type,
        vaultAddress: readAddress(payload.vaultAddress),
      }
    case 'vault.report':
      return {
        type,
        vaultAddress: readAddress(payload.vaultAddress),
      }
    case 'strategy.ajna.rebucket':
      return {
        type,
        vaultAddress: readAddress(payload.vaultAddress),
        targetBucket: readInt(payload.targetBucket, 'invalid_target_bucket'),
      }
    case 'strategy.charm.rebalance':
      return {
        type,
        vaultAddress: readAddress(payload.vaultAddress),
        charmVaultAddress: readAddress(payload.charmVaultAddress),
      }
    case 'solana.reconcile':
      return {
        type,
        workflow: readString(payload.workflow, 'invalid_solana_workflow'),
        action: readString(payload.action, 'invalid_solana_action'),
        checkpointKey: readString(payload.checkpointKey, 'invalid_checkpoint_key'),
      }
    default:
      throw new Error('unsupported_operator_action_type')
  }
}

