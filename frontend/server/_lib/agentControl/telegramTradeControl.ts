import {
  createActionProposal,
  createControlCapability,
  normalizeAddressOrNull,
  type ActionProposal,
  type ControlCapability,
  toTrimmed,
} from './types.js'

export const TELEGRAM_TRADE_CONTROL_SUBSYSTEM = 'telegram_trade'
export const TELEGRAM_TRADE_CONTROL_ACTIONS = ['trade.buy', 'trade.sell', 'trade.bid'] as const

export type TelegramTradeActionType = 'buy' | 'sell' | 'bid'
export type TelegramTradeControlAction = (typeof TELEGRAM_TRADE_CONTROL_ACTIONS)[number]

function sanitizeCorrelationPart(value: unknown): string {
  const normalized = String(value ?? '').trim()
  return normalized.replace(/[^a-zA-Z0-9:_-]/g, '')
}

function controlTradeAction(actionType: TelegramTradeActionType): TelegramTradeControlAction {
  return `trade.${actionType}` as TelegramTradeControlAction
}

function resolveTradeTargetAddress(params: {
  actionType: TelegramTradeActionType
  creatorCoinAddress: string
  vaultAddress: string
  targetAddress?: string | null
}): string {
  const explicitTarget = toTrimmed(params.targetAddress)
  if (explicitTarget) return explicitTarget
  if (params.actionType === 'bid') return params.vaultAddress
  return params.creatorCoinAddress || params.vaultAddress
}

export function buildTelegramTradeControlBundle(params: {
  actorId: string
  chatId: string
  actionType: TelegramTradeActionType
  callbackToken: string
  callbackKind: string
  intentPayload: Record<string, unknown>
  expiresAt: string
  consumedAt?: string | null
  chainId?: number
  vaultAddress?: string | null
  creatorCoinAddress?: string | null
  targetAddress?: string | null
  amountInput?: string | null
  amountEth?: number | null
  usdEstimate?: number | null
}): {
  subsystem: typeof TELEGRAM_TRADE_CONTROL_SUBSYSTEM
  controlAction: TelegramTradeControlAction
  correlationId: string
  capability: ControlCapability
  proposal: ActionProposal
  chainId?: number
  amountInput: string
  amountEth: number
  usdEstimate: number
  scopedVaultAddress: `0x${string}` | null
  scopedCreatorCoinAddress: `0x${string}` | null
  scopedTargetAddress: `0x${string}` | null
} {
  const rawIntent = params.intentPayload ?? {}
  const vaultAddress = toTrimmed(
    params.vaultAddress ?? (rawIntent as Record<string, unknown>).vaultAddress,
  ).toLowerCase()
  const creatorCoinAddress = toTrimmed(
    params.creatorCoinAddress ?? (rawIntent as Record<string, unknown>).creatorCoinAddress,
  ).toLowerCase()
  const targetAddress = resolveTradeTargetAddress({
    actionType: params.actionType,
    creatorCoinAddress,
    vaultAddress,
    targetAddress: params.targetAddress,
  }).toLowerCase()
  const amountInput = toTrimmed(
    params.amountInput ?? (rawIntent as Record<string, unknown>).amountInput,
  )
  const amountEthRaw = Number(
    params.amountEth ?? (rawIntent as Record<string, unknown>).amountEth ?? 0,
  )
  const usdEstimateRaw = Number(
    params.usdEstimate ?? (rawIntent as Record<string, unknown>).usdEstimate ?? 0,
  )
  const chainIdRaw = Number(
    params.chainId ?? (rawIntent as Record<string, unknown>).chainId,
  )
  const chainId = Number.isFinite(chainIdRaw) ? Math.trunc(chainIdRaw) : undefined
  const scopedVaultAddress = normalizeAddressOrNull(vaultAddress)
  const scopedCreatorCoinAddress = normalizeAddressOrNull(creatorCoinAddress)
  const scopedTargetAddress = normalizeAddressOrNull(targetAddress)
  const controlAction = controlTradeAction(params.actionType)
  const correlationId = [
    'tg_trade',
    sanitizeCorrelationPart(params.chatId),
    sanitizeCorrelationPart(params.actorId),
    Date.now().toString(36),
  ].join(':')

  const capability = createControlCapability({
    actor_type: 'telegram_user',
    actor_id: params.actorId,
    subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
    action: controlAction,
    confirmation_class: 'human_plus_policy',
    issued_by: 'telegram_action_token',
    expires_at: params.expiresAt,
    scope: {
      ...(typeof chainId === 'number' ? { chain_id: chainId } : {}),
      ...(scopedVaultAddress ? { vault_address: scopedVaultAddress } : {}),
      ...(scopedCreatorCoinAddress ? { creator_coin_address: scopedCreatorCoinAddress } : {}),
      actor_binding: {
        telegram_user_id: params.actorId,
        chat_id: params.chatId,
      },
    },
    limits: {
      ttl_seconds: 90,
      ...(scopedTargetAddress ? { allowed_targets: [scopedTargetAddress] } : {}),
    },
    metadata: {
      token_id: params.callbackToken,
      callback_kind: params.callbackKind,
      trade_action_type: params.actionType,
    },
  })

  const proposal = createActionProposal({
    capability_id: capability.capability_id,
    subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
    action: controlAction,
    intent: {
      ...rawIntent,
      action_type: params.actionType,
      callback_kind: params.callbackKind,
      callback_token: params.callbackToken,
      ...(typeof chainId === 'number' ? { chain_id: chainId } : {}),
      ...(scopedVaultAddress ? { vault_address: scopedVaultAddress } : {}),
      ...(scopedCreatorCoinAddress ? { creator_coin_address: scopedCreatorCoinAddress } : {}),
      ...(scopedTargetAddress ? { target_address: scopedTargetAddress } : {}),
    },
    bounds: {
      ...(typeof chainId === 'number' ? { chainId } : {}),
      vaultAddress: scopedVaultAddress,
      creatorCoinAddress: scopedCreatorCoinAddress,
      targetAddress: scopedTargetAddress,
      amountInput,
      amountEth: Number.isFinite(amountEthRaw) ? amountEthRaw : null,
      usdEstimate: Number.isFinite(usdEstimateRaw) ? usdEstimateRaw : null,
    },
    correlation_id: correlationId,
    requested_confirmation_class: 'human_plus_policy',
    metadata: {
      token_id: params.callbackToken,
      callback_kind: params.callbackKind,
      consumed_at: params.consumedAt ?? null,
    },
  })

  return {
    subsystem: TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
    controlAction,
    correlationId,
    capability,
    proposal,
    chainId,
    amountInput,
    amountEth: Number.isFinite(amountEthRaw) ? amountEthRaw : 0,
    usdEstimate: Number.isFinite(usdEstimateRaw) ? usdEstimateRaw : 0,
    scopedVaultAddress,
    scopedCreatorCoinAddress,
    scopedTargetAddress,
  }
}
