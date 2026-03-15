import { describe, expect, it } from 'vitest'

import { deriveActionTypeFromState, reduceTradeFlowState, TRADE_FLOW_IDLE_STATE } from '../_handlers/telegram/webhook/trade/fsm.js'
import type { TradeFlowState } from '../_handlers/telegram/webhook/trade/types.js'

describe('telegram trade flow FSM', () => {
  it('walks START -> VAULT_SELECTED -> PERCENT_SELECTED to preview-ready', () => {
    const start = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, { type: 'START', actionType: 'buy' })
    expect(start).toEqual({ status: 'VaultSelect', actionType: 'buy' })

    const vault = reduceTradeFlowState(start, {
      type: 'VAULT_SELECTED',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(vault).toEqual({
      status: 'SizeSelect',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })

    const preview = reduceTradeFlowState(vault, {
      type: 'PERCENT_SELECTED',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      percentBps: 5000,
    })
    expect(preview).toEqual({
      status: 'PreviewReady',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      percentBps: 5000,
    })
  })

  it('supports custom-input path and invalid-input failure path', () => {
    const start = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, { type: 'START', actionType: 'sell' })
    const vault = reduceTradeFlowState(start, {
      type: 'VAULT_SELECTED',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
    })
    const custom = reduceTradeFlowState(vault, {
      type: 'CUSTOM_SELECTED',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
    })
    expect(custom).toEqual({
      status: 'CustomPercentAwaitingInput',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
    })

    const invalid = reduceTradeFlowState(custom, {
      type: 'CUSTOM_INPUT_INVALID',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
      reason: 'invalid_custom_percent',
    })
    expect(invalid).toEqual({
      status: 'Failed',
      actionType: 'sell',
      reason: 'invalid_custom_percent',
    })

    const valid = reduceTradeFlowState(custom, {
      type: 'CUSTOM_INPUT_VALID',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
      percentBps: 4200,
    })
    expect(valid).toEqual({
      status: 'PreviewReady',
      actionType: 'sell',
      vaultAddress: '0x2222222222222222222222222222222222222222',
      percentBps: 4200,
    })
  })

  it('maps accept/decline/token-invalid to terminal states', () => {
    const executing = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, {
      type: 'ACCEPT',
      actionType: 'bid',
      token: 'tok_1',
    })
    expect(executing).toEqual({
      status: 'Executing',
      actionType: 'bid',
      token: 'tok_1',
    })

    const declined = reduceTradeFlowState(executing, {
      type: 'DECLINE',
      actionType: 'bid',
      token: 'tok_1',
    })
    expect(declined).toEqual({
      status: 'Completed',
      actionType: 'bid',
      token: 'tok_1',
    })

    const invalid = reduceTradeFlowState(TRADE_FLOW_IDLE_STATE, {
      type: 'TOKEN_INVALID',
      actionType: 'bid',
      reason: 'expired',
    })
    expect(invalid).toEqual({
      status: 'Failed',
      actionType: 'bid',
      reason: 'expired',
    })
  })

  it('derives action type from all non-idle states', () => {
    const states: Array<Exclude<TradeFlowState, { status: 'Idle' }>> = [
      { status: 'VaultSelect', actionType: 'buy' },
      { status: 'SizeSelect', actionType: 'sell', vaultAddress: '0x1111111111111111111111111111111111111111' },
      { status: 'CustomPercentAwaitingInput', actionType: 'bid', vaultAddress: '0x1111111111111111111111111111111111111111' },
      { status: 'PreviewReady', actionType: 'buy', vaultAddress: '0x1111111111111111111111111111111111111111', percentBps: 5000 },
      { status: 'Executing', actionType: 'sell', token: 'tok_2' },
      { status: 'Completed', actionType: 'bid', token: 'tok_3' },
      { status: 'Failed', actionType: 'buy', reason: 'expired' },
    ]
    for (const state of states) {
      expect(deriveActionTypeFromState(state)).toBe(state.actionType)
    }
    expect(deriveActionTypeFromState({ status: 'Idle' })).toBeNull()
  })
})
