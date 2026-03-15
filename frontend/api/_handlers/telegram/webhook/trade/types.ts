import type { InteractiveTradeAction } from '../types.js'

export type TradeFlowState =
  | { status: 'Idle' }
  | { status: 'VaultSelect'; actionType: InteractiveTradeAction }
  | { status: 'SizeSelect'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { status: 'CustomPercentAwaitingInput'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { status: 'PreviewReady'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { status: 'Executing'; actionType: InteractiveTradeAction; token: string }
  | { status: 'Completed'; actionType: InteractiveTradeAction; token?: string }
  | { status: 'Failed'; actionType: InteractiveTradeAction; reason: string }

export type TradeFlowEvent =
  | { type: 'START'; actionType: InteractiveTradeAction }
  | { type: 'VAULT_SELECTED'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { type: 'PERCENT_SELECTED'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { type: 'CUSTOM_SELECTED'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}` }
  | { type: 'CUSTOM_INPUT_VALID'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; percentBps: number }
  | { type: 'CUSTOM_INPUT_INVALID'; actionType: InteractiveTradeAction; vaultAddress: `0x${string}`; reason: string }
  | { type: 'ACCEPT'; actionType: InteractiveTradeAction; token: string }
  | { type: 'DECLINE'; actionType: InteractiveTradeAction; token?: string }
  | { type: 'TOKEN_INVALID'; actionType: InteractiveTradeAction; reason: string }
