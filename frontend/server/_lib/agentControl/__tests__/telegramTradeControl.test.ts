import { describe, expect, it } from 'vitest'

import {
  TELEGRAM_TRADE_CONTROL_SUBSYSTEM,
  buildTelegramTradeControlBundle,
} from '../telegramTradeControl.js'

describe('telegram trade control bundle', () => {
  it('builds a capability, proposal, and correlation id for buy intents', () => {
    const bundle = buildTelegramTradeControlBundle({
      actorId: '99',
      chatId: '-100123',
      actionType: 'buy',
      callbackToken: 'trade-token-1',
      callbackKind: 'accept',
      intentPayload: {
        vaultAddress: '0x1111111111111111111111111111111111111111',
        creatorCoinAddress: '0x2222222222222222222222222222222222222222',
        amountInput: '0.05',
        amountEth: 0.05,
        usdEstimate: 150,
      },
      expiresAt: '2026-03-13T00:01:30.000Z',
      consumedAt: '2026-03-13T00:00:32.000Z',
    })

    expect(bundle.subsystem).toBe(TELEGRAM_TRADE_CONTROL_SUBSYSTEM)
    expect(bundle.controlAction).toBe('trade.buy')
    expect(bundle.correlationId).toMatch(/^tg_trade:/)
    expect(bundle.capability.scope.actor_binding).toMatchObject({
      telegram_user_id: '99',
      chat_id: '-100123',
    })
    expect(bundle.proposal.intent).toMatchObject({
      action_type: 'buy',
      callback_kind: 'accept',
      callback_token: 'trade-token-1',
      vault_address: '0x1111111111111111111111111111111111111111',
      creator_coin_address: '0x2222222222222222222222222222222222222222',
    })
  })
})
