import type { TradeFlowEvent, TradeFlowState } from './types.js'

export const TRADE_FLOW_IDLE_STATE: TradeFlowState = { status: 'Idle' }

export function reduceTradeFlowState(current: TradeFlowState, event: TradeFlowEvent): TradeFlowState {
  switch (event.type) {
    case 'START':
      return {
        status: 'VaultSelect',
        actionType: event.actionType,
      }

    case 'VAULT_SELECTED':
      return {
        status: 'SizeSelect',
        actionType: event.actionType,
        vaultAddress: event.vaultAddress,
      }

    case 'PERCENT_SELECTED':
    case 'CUSTOM_INPUT_VALID':
      return {
        status: 'PreviewReady',
        actionType: event.actionType,
        vaultAddress: event.vaultAddress,
        percentBps: event.percentBps,
      }

    case 'CUSTOM_SELECTED':
      return {
        status: 'CustomPercentAwaitingInput',
        actionType: event.actionType,
        vaultAddress: event.vaultAddress,
      }

    case 'CUSTOM_INPUT_INVALID':
      return {
        status: 'Failed',
        actionType: event.actionType,
        reason: event.reason,
      }

    case 'ACCEPT':
      return {
        status: 'Executing',
        actionType: event.actionType,
        token: event.token,
      }

    case 'DECLINE':
      return {
        status: 'Completed',
        actionType: event.actionType,
        ...(event.token ? { token: event.token } : {}),
      }

    case 'TOKEN_INVALID':
      return {
        status: 'Failed',
        actionType: event.actionType,
        reason: event.reason,
      }

    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export function deriveActionTypeFromState(state: TradeFlowState): 'buy' | 'sell' | 'bid' | null {
  switch (state.status) {
    case 'Idle':
      return null
    case 'VaultSelect':
    case 'SizeSelect':
    case 'CustomPercentAwaitingInput':
    case 'PreviewReady':
    case 'Executing':
    case 'Completed':
    case 'Failed':
      return state.actionType
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}
