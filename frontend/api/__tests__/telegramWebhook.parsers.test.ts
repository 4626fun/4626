import { describe, expect, it } from 'vitest'

import { shouldAutoRouteToAi } from '../_handlers/telegram/webhook/parsers/command.js'
import { parseDeployCallbackData, parseTelegramDeployIntent } from '../_handlers/telegram/webhook/parsers/deploy.js'
import { parseHolderRoomIdentifier } from '../_handlers/telegram/webhook/parsers/holderRooms.js'
import { commandHasArguments, parseTelegramTradeIntent, parseTradeCallbackData, parseTradeFlowCallbackData } from '../_handlers/telegram/webhook/parsers/trade.js'

describe('telegram webhook parsers', () => {
  it('parses buy, sell, and bid trade intents', () => {
    expect(parseTelegramTradeIntent('/buy 0x1111111111111111111111111111111111111111 0.42')).toMatchObject({
      actionType: 'buy',
      amountUnit: 'ETH',
      amountInput: '0.42',
    })
    expect(parseTelegramTradeIntent('/sell 0x1111111111111111111111111111111111111111 12.5')).toMatchObject({
      actionType: 'sell',
      amountUnit: 'SHARE',
      amountInput: '12.5',
    })
    expect(parseTelegramTradeIntent('/bid 0x1111111111111111111111111111111111111111 $99')).toMatchObject({
      actionType: 'bid',
      amountUnit: 'USD',
      amountInput: '99',
    })
  })

  it('rejects malformed trade intents', () => {
    expect(parseTelegramTradeIntent('/buy')).toBeNull()
    expect(parseTelegramTradeIntent('/bid vault not-a-number')).toBeNull()
  })

  it('detects whether interactive trade command has arguments', () => {
    expect(commandHasArguments('/buy', 'buy')).toBe(false)
    expect(commandHasArguments('/buy vault 1', 'buy')).toBe(true)
    expect(commandHasArguments('/sell vault 10', 'sell')).toBe(true)
  })

  it('parses tradeflow callback payloads', () => {
    expect(parseTradeFlowCallbackData('tradeflow:v:buy:0x1111111111111111111111111111111111111111')).toEqual({
      kind: 'vault',
      actionType: 'buy',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(parseTradeFlowCallbackData('tradeflow:p:sell:0x1111111111111111111111111111111111111111:2500')).toEqual({
      kind: 'percent',
      actionType: 'sell',
      vaultAddress: '0x1111111111111111111111111111111111111111',
      percentBps: 2500,
    })
    expect(parseTradeFlowCallbackData('tradeflow:c:bid:0x1111111111111111111111111111111111111111')).toEqual({
      kind: 'custom',
      actionType: 'bid',
      vaultAddress: '0x1111111111111111111111111111111111111111',
    })
    expect(parseTradeFlowCallbackData('tradeflow:p:buy:0x1111111111111111111111111111111111111111:99999')).toBeNull()
  })

  it('parses trade callback aliases for accept/decline', () => {
    expect(parseTradeCallbackData('trade:confirm:abc123')).toEqual({ kind: 'accept', token: 'abc123' })
    expect(parseTradeCallbackData('trade:cancel:abc123')).toEqual({ kind: 'decline', token: 'abc123' })
    expect(parseTradeCallbackData('trade:edit:buy')).toEqual({ kind: 'edit', actionType: 'buy' })
  })

  it('parses deploy command intents and callback aliases', () => {
    expect(parseTelegramDeployIntent('/deploy')).toEqual({ kind: 'menu' })
    expect(parseTelegramDeployIntent('/deploy trend BASEAI')).toEqual({ kind: 'trend', ticker: 'BASEAI' })

    const coinIntent = parseTelegramDeployIntent('/deploy content "Base Daily Recap" BDR')
    expect(coinIntent?.kind).toBe('coin')
    expect(coinIntent && coinIntent.kind === 'coin' ? coinIntent.commandCurrency : null).toBe('CREATOR_COIN')

    expect(parseDeployCallbackData('deploy:accept:tok_123')).toEqual({ kind: 'confirm', token: 'tok_123' })
    expect(parseDeployCallbackData('deploy:cancel:tok_123')).toEqual({ kind: 'decline', token: 'tok_123' })
  })

  it('parses holder-room identifiers from join and eligibility commands', () => {
    expect(parseHolderRoomIdentifier('/join BASEAI', 'join')).toBe('BASEAI')
    expect(parseHolderRoomIdentifier('/eligibility 0x1111111111111111111111111111111111111111', 'eligibility')).toBe(
      '0x1111111111111111111111111111111111111111',
    )
    expect(parseHolderRoomIdentifier('/join', 'join')).toBe('')
  })

  it('auto-routes follow-up text into AI only when expected', () => {
    const isPrivateChatId = (chatId: string) => !chatId.startsWith('-')

    expect(
      shouldAutoRouteToAi({
        chatId: '7726886643',
        text: 'how are we doing',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(true)

    expect(
      shouldAutoRouteToAi({
        chatId: '-1001',
        text: 'how are we doing',
        message: { reply_to_message: { from: { is_bot: true } } },
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(true)

    expect(
      shouldAutoRouteToAi({
        chatId: '-1001',
        text: '/help',
        message: {},
        aiFollowupEnabled: true,
        isPrivateChatId,
      }),
    ).toBe(false)
  })
})
